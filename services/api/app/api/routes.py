from __future__ import annotations

from datetime import timedelta
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from shapely.geometry import shape

from app.api.infrastructure import Actor, Db
from app.core.config import settings
from app.core.policy import can_access, require_permission
from app.models import ApprovedRoute
from app.services.geometry import validate_geometry
from app.services.registry import as_json, audit, authorized_object, now, visible_data

router = APIRouter(tags=["Approved navigation"])


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    destination_object_id: str
    origin: dict[str, Any]


def route_dict(row):
    return {key: as_json(getattr(row, key)) for key in ("id", "requested_by", "destination_object_id", "geometry", "steps",
        "distance_m", "duration_s", "status", "approved_by", "expires_at", "source_date", "version", "created_at")}


@router.post("/routes", status_code=201)
def request_route(body: RouteRequest, db: Db, user: Actor):
    require_permission(user, "infrastructure.read", db)
    obj = authorized_object(db, user, body.destination_object_id)
    data = visible_data(db, user, obj)
    if not obj.published_revision_id:
        raise HTTPException(409, "Faqat tasdiqlangan operativ obyektga marshrut tuziladi")
    origin = validate_geometry(body.origin, ["Point"])["coordinates"]
    destination = shape(data["geometry"]).representative_point()
    coordinates = f"{origin[0]},{origin[1]};{destination.x},{destination.y}"
    try:
        with httpx.Client(timeout=20) as client:
            response = client.get(f"{settings.osrm_url.rstrip('/')}/route/v1/driving/{coordinates}",
                                  params={"overview": "full", "geometries": "geojson", "steps": "true"})
            response.raise_for_status()
            result = response.json()
        if result.get("code") != "Ok" or not result.get("routes"):
            raise ValueError("No authorized routing result")
        route = result["routes"][0]
        geometry = validate_geometry(route["geometry"], ["LineString"])
        steps = [{"name": step.get("name", ""), "distance_m": step.get("distance"), "duration_s": step.get("duration"),
                  "maneuver": step.get("maneuver", {})} for leg in route["legs"] for step in leg.get("steps", [])]
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(503, {"code": "ROUTING_UNAVAILABLE", "message": "Xususiy marshrut xizmati hozir mavjud emas. Soxta marshrut yaratilmaydi."}) from exc
    row = ApprovedRoute(requested_by=user.id, destination_object_id=obj.id, geometry=geometry, steps=steps,
                        distance_m=route["distance"], duration_s=route["duration"], source_date=getattr(settings, "osrm_source_date", "unknown"), status="pending")
    db.add(row)
    db.flush()
    audit(db, user, "route.request", row.id)
    db.commit()
    return route_dict(row)


@router.get("/routes")
def list_routes(db: Db, user: Actor):
    require_permission(user, "infrastructure.read", db)
    rows = db.scalars(select(ApprovedRoute).order_by(ApprovedRoute.created_at.desc()).limit(200)).all()
    items = []
    for row in rows:
        try:
            obj = authorized_object(db, user, row.destination_object_id)
        except HTTPException:
            continue
        if row.requested_by == user.id or can_access(db, user, obj, permission="routes.approve"):
            data = route_dict(row)
            if row.expires_at and row.expires_at <= now():
                data["status"] = "expired"
            items.append(data)
    return {"items": items, "total": len(items)}


@router.get("/routes/{route_id}")
def get_route(route_id: str, db: Db, user: Actor):
    row = db.get(ApprovedRoute, route_id)
    if row is None:
        raise HTTPException(404, "Marshrut topilmadi")
    obj = authorized_object(db, user, row.destination_object_id)
    if row.requested_by != user.id and not can_access(db, user, obj, permission="routes.approve"):
        raise HTTPException(404, "Marshrut topilmadi")
    data = route_dict(row)
    if row.expires_at and row.expires_at <= now():
        data["status"] = "expired"
    return data


@router.post("/routes/{route_id}/approve")
def approve_route(route_id: str, db: Db, user: Actor):
    require_permission(user, "routes.approve", db)
    row = db.get(ApprovedRoute, route_id)
    if row is None:
        raise HTTPException(404, "Marshrut topilmadi")
    authorized_object(db, user, row.destination_object_id, permission="routes.approve")
    if row.requested_by == user.id:
        raise HTTPException(403, "Marshrutni boshqa vakolatli rahbar tasdiqlashi kerak")
    if row.status != "pending":
        raise HTTPException(409, "Marshrut allaqachon ko‘rib chiqilgan")
    if row.source_date == "unknown":
        raise HTTPException(409, "Marshrut manbasi sanasi sozlanmaguncha tasdiqlab bo‘lmaydi")
    row.status, row.approved_by = "approved", user.id
    row.expires_at = now() + timedelta(hours=settings.offline_lease_hours)
    row.version += 1
    audit(db, user, "route.approve", row.id)
    db.commit()
    return route_dict(row)


@router.post("/routes/{route_id}/withdraw")
def withdraw_route(route_id: str, db: Db, user: Actor):
    require_permission(user, "routes.approve", db)
    row = db.get(ApprovedRoute, route_id)
    if row is None:
        raise HTTPException(404, "Marshrut topilmadi")
    authorized_object(db, user, row.destination_object_id, permission="routes.approve")
    row.status, row.expires_at = "withdrawn", now()
    row.version += 1
    audit(db, user, "route.withdraw", row.id)
    db.commit()
    return route_dict(row)
