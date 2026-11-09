from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import Geography
from sqlalchemy import String, cast, func, select
from shapely.geometry import box, shape

from app.api.infrastructure import Actor, Db
from app.core.config import settings
from app.core.policy import can_access, require_permission, scope_query
from app.db.session import get_public_db
from sqlalchemy.orm import Session
from app.models import District, InfrastructureCategory, InfrastructureObject, ObjectRevision, Organization, PublicObject, Region
from app.services.geometry import parse_bbox
from app.services.registry import as_json

router = APIRouter(tags=["GIS"])
PublicDb = Annotated[Session, Depends(get_public_db)]


def category_dict(row):
    return {"id": row.id, "name_uz": row.name_uz, "name_ru": row.name_ru, "name_en": row.name_en,
            "geometry_types": row.geometry_types, "schema_version": row.schema_version,
            "passport_schema": row.passport_schema, "schema": row.passport_schema, "icon": row.icon, "color": row.color}


@router.get("/categories")
def categories(db: Db):
    rows = db.scalars(select(InfrastructureCategory).order_by(InfrastructureCategory.name_uz)).all()
    return {"items": [category_dict(row) for row in rows], "total": len(rows)}


@router.get("/organizations")
def organizations(db: Db, user: Actor):
    require_permission(user, "infrastructure.read", db)
    from app.models import RoleAssignment
    assignments = db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)).all()
    from sqlalchemy import or_
    conditions = []
    for assignment in assignments:
        query_conditions = []
        if assignment.organization_id:
            query_conditions.append(Organization.id == assignment.organization_id)
        if assignment.region_id:
            query_conditions.append(Organization.region_id == assignment.region_id)
        from sqlalchemy import and_
        conditions.append(and_(*query_conditions) if query_conditions else True)
    query = select(Organization).where(or_(*conditions) if conditions else False)
    rows = db.scalars(query.order_by(Organization.name)).all()
    return {"items": [{"id": row.id, "name": row.name, "region_id": row.region_id,
                        "is_synthetic": row.is_synthetic} for row in rows], "total": len(rows)}


@router.get("/public/registration/organizations")
def registration_organizations(db: Db):
    """Only operator-approved organization names may enter unauthenticated onboarding."""
    query = select(Organization)
    if settings.is_development:
        query = query.where(Organization.is_synthetic.is_(True))
    else:
        allowed = [value.strip() for value in settings.registration_organization_ids.split(",") if value.strip()]
        query = query.where(Organization.id.in_(allowed))
    rows = db.scalars(query.order_by(Organization.name)).all()
    return {"items": [{"id": row.id, "name": row.name} for row in rows], "total": len(rows)}


@router.get("/gis/regions")
def regions(db: Db):
    rows = db.scalars(select(Region).order_by(Region.name_uz)).all()
    return {"items": [{"id": row.id, "name_uz": row.name_uz, "name_ru": row.name_ru,
                        "name_en": row.name_en, "source": row.source, "geometry": row.geometry} for row in rows], "total": len(rows)}


@router.get("/gis/districts")
def districts(db: Db, region_id: str | None = None):
    query = select(District)
    if region_id:
        query = query.where(District.region_id == region_id)
    rows = db.scalars(query.order_by(District.name_uz)).all()
    return {"items": [{"id": row.id, "region_id": row.region_id, "name_uz": row.name_uz,
                        "name_ru": row.name_ru, "name_en": row.name_en, "is_synthetic": row.is_synthetic} for row in rows], "total": len(rows)}


@router.get("/public/config")
def public_config():
    return {"name": "FVV GIS Uzbekistan", "independent_project": True, "official_dispatch_connected": False,
            "default_language": "uz", "map_style_url": settings.map_style_url,
            "live_intake_enabled": settings.live_intake_enabled and settings.live_policy_ready,
            "operator_name": settings.operator_name or "Mustaqil baholash loyihasi", "operator_contact": settings.operator_contact,
            "offline_lease_hours": settings.offline_lease_hours, "notice": "Favqulodda vaziyatda 112 raqamiga qo‘ng‘iroq qiling. Ilova rasmiy dispetcherlik tizimiga ulanmagan."}


def public_feature(row):
    # Public projection deliberately has an unrelated ID and no source record ID/passport/employee fields.
    return {"type": "Feature", "id": row.id, "geometry": row.geometry,
            "properties": {"id": row.id, "name": row.name, "category_id": row.category_id, "region_id": row.region_id,
                           "district_id": row.district_id, "operational_status": row.operational_status,
                           "updated_at": as_json(row.updated_at), "is_synthetic": row.is_synthetic}}


def operational_feature(db, obj):
    published = db.get(ObjectRevision, obj.published_revision_id) if obj.published_revision_id else None
    if published is None:
        return None
    data = published.data
    keys = ("id", "code", "name", "category_id", "region_id", "district_id", "operational_status", "lifecycle", "version",
            "updated_at", "is_synthetic", "accuracy_m", "survey_date", "verification_status")
    return {"type": "Feature", "id": obj.id, "geometry": data["geometry"], "properties": {key: data.get(key) for key in keys}}


def filtered_features(features, bbox: str | None):
    bounds = parse_bbox(bbox)
    if bounds:
        extent = box(*bounds)
        return [feature for feature in features if shape(feature["geometry"]).intersects(extent)]
    return features


@router.get("/public/gis/objects")
def public_objects(db: PublicDb, bbox: str | None = None, category_id: str | None = None, region_id: str | None = None,
                   status: str | None = None, search: str | None = Query(default=None, max_length=200),
                   limit: int = Query(default=1000, ge=1, le=5000), offset: int = Query(default=0, ge=0)):
    query = select(PublicObject)
    for field, value in (("category_id", category_id), ("region_id", region_id), ("operational_status", status)):
        if value:
            query = query.where(getattr(PublicObject, field) == value)
    if search:
        query = query.where(PublicObject.name.ilike(f"%{search}%"))
    rows = db.scalars(query.order_by(PublicObject.id)).all()
    features = filtered_features([public_feature(row) for row in rows], bbox)
    return {"type": "FeatureCollection", "features": features[offset:offset + limit], "total": len(features)}


@router.get("/gis/objects")
def operational_objects(db: Db, user: Actor, bbox: str | None = None, category_id: str | None = None,
                        region_id: str | None = None, district_id: str | None = None, status: str | None = None,
                        limit: int = Query(default=1000, ge=1, le=5000), offset: int = Query(default=0, ge=0)):
    require_permission(user, "infrastructure.read", db)
    query = scope_query(db, user, select(InfrastructureObject)).where(
        InfrastructureObject.deleted_at.is_(None), InfrastructureObject.published_revision_id.is_not(None))
    for field, value in (("category_id", category_id), ("region_id", region_id), ("district_id", district_id)):
        if value:
            query = query.where(getattr(InfrastructureObject, field) == value)
    rows = db.scalars(query.order_by(InfrastructureObject.id)).all()
    features = [feature for obj in rows if can_access(db, user, obj) and (feature := operational_feature(db, obj)) is not None]
    if status:
        features = [f for f in features if f["properties"].get("operational_status") == status]
    features = filtered_features(features, bbox)
    return {"type": "FeatureCollection", "features": features[offset:offset + limit], "total": len(features)}


@router.get("/public/gis/layers")
def public_layers(db: PublicDb):
    counts = dict(db.execute(select(PublicObject.category_id, func.count()).group_by(PublicObject.category_id)).all())
    rows = db.scalars(select(InfrastructureCategory).where(InfrastructureCategory.id.in_(list(counts)))).all()
    return {"items": [{**category_dict(row), "count": counts[row.id], "visibility": "public"} for row in rows], "total": len(rows)}


@router.get("/gis/layers")
def layers(db: Db, user: Actor):
    require_permission(user, "infrastructure.read", db)
    scoped = scope_query(db, user, select(InfrastructureObject.category_id).where(
        InfrastructureObject.deleted_at.is_(None), InfrastructureObject.published_revision_id.is_not(None)))
    counts = {}
    for category_id in db.scalars(scoped).all():
        counts[category_id] = counts.get(category_id, 0) + 1
    rows = db.scalars(select(InfrastructureCategory)).all()
    return {"items": [{**category_dict(row), "count": counts.get(row.id, 0), "visibility": "authorized"} for row in rows], "total": len(rows)}


@router.get("/gis/nearby")
def nearby(db: Db, user: Actor, longitude: float = Query(ge=-180, le=180), latitude: float = Query(ge=-90, le=90),
           radius_m: float = Query(default=1000, gt=0, le=50000), limit: int = Query(default=100, ge=1, le=500)):
    require_permission(user, "infrastructure.read", db)
    published_geom = func.ST_SetSRID(func.ST_GeomFromGeoJSON(cast(ObjectRevision.data["geometry"], String)), 4326)
    point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    distance = func.ST_Distance(cast(published_geom, Geography), cast(point, Geography)).label("distance_m")
    query = select(InfrastructureObject, distance).join(ObjectRevision, ObjectRevision.id == InfrastructureObject.published_revision_id)
    query = scope_query(db, user, query).where(InfrastructureObject.deleted_at.is_(None),
        func.ST_DWithin(cast(published_geom, Geography), cast(point, Geography), radius_m)).order_by(distance).limit(limit)
    items = []
    for obj, meters in db.execute(query):
        if can_access(db, user, obj):
            feature = operational_feature(db, obj)
            if feature:
                feature["properties"]["distance_m"] = round(meters, 2)
                items.append(feature)
    return {"type": "FeatureCollection", "features": items, "total": len(items)}


@router.get("/public/gis/tiles/{z}/{x}/{y}.pbf")
def public_tile(z: int, x: int, y: int, db: PublicDb):
    from fastapi import Response
    if not (0 <= z <= 18 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
        raise HTTPException(422, "Xarita plitkasi koordinatasi noto‘g‘ri")
    # This statement touches public_objects only, including counts and geometry.
    from sqlalchemy import text
    tile = db.execute(text("""
      SELECT ST_AsMVT(tile, 'public_infrastructure', 4096, 'geom') FROM (
        SELECT id, name, category_id, operational_status, is_synthetic,
          ST_AsMVTGeom(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text),4326),3857),
                       ST_TileEnvelope(:z,:x,:y),4096,64,true) AS geom
        FROM public_objects
        WHERE ST_Intersects(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text),4326),3857), ST_TileEnvelope(:z,:x,:y))
      ) AS tile
    """), {"z": z, "x": x, "y": y}).scalar()
    return Response(bytes(tile or b""), media_type="application/vnd.mapbox-vector-tile",
                    headers={"Cache-Control": "public, max-age=60"})
