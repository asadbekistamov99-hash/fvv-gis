from datetime import UTC, date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.api.infrastructure import Actor, Db
from app.core.policy import require_permission
from app.models import HydrantMeasurement, Inspection, MaintenanceRecord
from app.services.registry import STATES, as_json, audit, authorized_object, visible_data

router = APIRouter(tags=["Inspections"])


class InspectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    object_id: str
    condition: str = Field(min_length=2, max_length=80)
    notes: str | None = Field(default=None, max_length=10000)
    operational_status: str = "unknown"
    inspected_at: datetime | None = None
    next_inspection_date: date | None = None
    measurements: dict[str, Any] = Field(default_factory=dict)


def inspection_dict(row):
    return {key: as_json(getattr(row, key)) for key in ("id", "object_id", "inspector_id", "inspected_at", "condition",
            "operational_status", "notes", "next_inspection_date", "measurements", "created_at")}


@router.post("/inspections", status_code=201)
def add_inspection(body: InspectionCreate, db: Db, user: Actor):
    require_permission(user, "inspections.create", db)
    obj = authorized_object(db, user, body.object_id, permission="inspections.create")
    if body.operational_status not in STATES:
        raise HTTPException(422, "Obyekt holati noto‘g‘ri")
    measured_at = body.inspected_at or datetime.now(UTC)
    if measured_at.tzinfo is None:
        raise HTTPException(422, "Tekshiruv vaqtida vaqt zonasi majburiy")
    measurements = body.measurements
    if measurements:
        from app.services.passports import validate_passport
        measurements = validate_passport(obj.category_id, {**measurements, "measurement_date": measured_at.isoformat()})
    row = Inspection(object_id=obj.id, inspector_id=user.id, inspected_at=measured_at,
                     condition=body.condition, operational_status=body.operational_status, notes=body.notes,
                     next_inspection_date=body.next_inspection_date, measurements=measurements)
    db.add(row)
    db.flush()
    if "hydrant" in obj.category_id and measurements:
        db.add(HydrantMeasurement(object_id=obj.id, pressure_kpa=measurements.get("measured_pressure_kpa"),
                                 flow_lps=measurements.get("flow_lps"), measured_at=measured_at,
                                 method=measurements.get("measurement_method") or "inspection", measured_by=user.id))
    audit(db, user, "inspection.create", row.id)
    db.commit()
    return inspection_dict(row)


@router.get("/infrastructure/{object_id}/inspections")
def inspections(object_id: str, db: Db, user: Actor):
    authorized_object(db, user, object_id)
    rows = db.scalars(select(Inspection).where(Inspection.object_id == object_id).order_by(Inspection.inspected_at.desc())).all()
    return {"items": [inspection_dict(row) for row in rows], "total": len(rows)}


@router.get("/inspections")
def all_inspections(db: Db, user: Actor):
    from app.core.policy import scope_query
    from app.models import InfrastructureObject
    require_permission(user, "infrastructure.read", db)
    ids = scope_query(db, user, select(InfrastructureObject.id))
    rows = db.scalars(select(Inspection).where(Inspection.object_id.in_(ids)).order_by(Inspection.inspected_at.desc()).limit(200)).all()
    items = []
    for row in rows:
        try:
            authorized_object(db, user, row.object_id)
        except HTTPException:
            continue
        items.append(inspection_dict(row))
    return {"items": items, "total": len(items)}


class MaintenanceCreate(BaseModel):
    description: str = Field(min_length=5, max_length=10000)
    performed_at: datetime
    status: str = Field(default="completed", max_length=50)


@router.post("/infrastructure/{object_id}/maintenance", status_code=201)
def add_maintenance(object_id: str, body: MaintenanceCreate, db: Db, user: Actor):
    require_permission(user, "inspections.create", db)
    authorized_object(db, user, object_id, permission="inspections.create")
    if body.performed_at.tzinfo is None:
        raise HTTPException(422, "Vaqt zonasi majburiy")
    row = MaintenanceRecord(object_id=object_id, performed_by=user.id, performed_at=body.performed_at,
                            description=body.description, status=body.status)
    db.add(row)
    db.flush()
    audit(db, user, "maintenance.create", row.id)
    db.commit()
    return {key: as_json(getattr(row, key)) for key in ("id", "object_id", "performed_at", "description", "status")}


@router.get("/infrastructure/{object_id}/maintenance")
def maintenance(object_id: str, db: Db, user: Actor):
    authorized_object(db, user, object_id)
    rows = db.scalars(select(MaintenanceRecord).where(MaintenanceRecord.object_id == object_id).order_by(MaintenanceRecord.performed_at.desc())).all()
    return {"items": [{key: as_json(getattr(row, key)) for key in ("id", "object_id", "performed_by", "performed_at", "description", "status")} for row in rows], "total": len(rows)}
