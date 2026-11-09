from __future__ import annotations

from typing import Any
import hashlib
import json
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, text

from app.api.infrastructure import Actor, Db, live_gate
from app.core.policy import require_permission, scope_query
from app.models import CitizenReport, Notification, Region, SyncOperation, User
from app.services.geometry import validate_geometry
from app.services.registry import as_json, audit, now

router = APIRouter(tags=["Citizen reports"])


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=5, max_length=10000)
    geometry: dict[str, Any] | None = None
    contact_phone: str | None = Field(default=None, max_length=80)
    contact_information: str | None = Field(default=None, max_length=255)
    region_id: str | None = None
    is_synthetic: bool = True


class ReportPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str | None = None
    assigned_to: str | None = None
    category: str | None = Field(default=None, min_length=2, max_length=100)


def report_dict(row):
    fields = ("id", "user_id", "category", "description", "geometry", "contact_information", "region_id", "status",
              "assigned_to", "is_synthetic", "created_at", "updated_at", "closed_at")
    return {key: as_json(getattr(row, key)) for key in fields}


def get_report(db, user, report_id: str, *, manage=False):
    row = db.get(CitizenReport, report_id)
    if row is None:
        raise HTTPException(404, "Murojaat topilmadi")
    if not manage and row.user_id == user.id:
        return row
    require_permission(user, "reports.manage", db)
    scoped = scope_query(db, user, select(CitizenReport.id).where(CitizenReport.id == report_id), model=CitizenReport, permission="reports.manage")
    if not db.scalar(scoped):
        raise HTTPException(404, "Murojaat topilmadi")
    return row


@router.post("/reports", status_code=201)
def create_report(body: ReportCreate, db: Db, user: Actor, idempotency_key: UUID | None = Header(default=None)):
    live_gate(body.is_synthetic)
    require_permission(user, "reports.create", db)
    geometry = validate_geometry(body.geometry, ["Point"]) if body.geometry else None
    if not body.is_synthetic and not body.region_id:
        raise HTTPException(422, "Haqiqiy murojaat uchun hudud majburiy")
    if body.region_id and db.get(Region, body.region_id) is None:
        raise HTTPException(422, "Hudud topilmadi")
    digest = hashlib.sha256(("report:" + json.dumps(body.model_dump(mode="json"), sort_keys=True, allow_nan=False)).encode()).hexdigest()
    if idempotency_key:
        lock_key = int.from_bytes(hashlib.sha256(f"{user.id}:{idempotency_key}".encode()).digest()[:8], "big", signed=True)
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
        previous = db.scalar(select(SyncOperation).where(SyncOperation.user_id == user.id,
            SyncOperation.operation_id == str(idempotency_key)))
        if previous:
            if previous.payload_hash != digest:
                raise HTTPException(409, {"code": "IDEMPOTENCY_MISMATCH", "message": "Identifikator boshqa mazmun bilan qayta ishlatilgan"})
            report_id = previous.result.get("report_id")
            row = db.get(CitizenReport, report_id) if report_id else None
            if row is None or row.user_id != user.id:
                raise HTTPException(410, "Avvalgi murojaat saqlash siyosati asosida o‘chirilgan")
            return report_dict(row)
    row = CitizenReport(user_id=user.id, category=body.category, description=body.description, geometry=geometry,
                        contact_information=body.contact_information or body.contact_phone, region_id=body.region_id,
                        is_synthetic=body.is_synthetic, status="received")
    db.add(row)
    db.flush()
    if idempotency_key:
        # Retain only an opaque ID; expired personal report contents must not survive in idempotency results.
        db.add(SyncOperation(user_id=user.id, operation_id=str(idempotency_key), payload_hash=digest,
                             result={"report_id": row.id}, status="success"))
    audit(db, user, "report.create", row.id)
    db.commit()
    return report_dict(row)


@router.get("/reports/my")
def my_reports(db: Db, user: Actor, limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    query = select(CitizenReport).where(CitizenReport.user_id == user.id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(CitizenReport.created_at.desc()).offset(offset).limit(limit)).all()
    return {"items": [report_dict(row) for row in rows], "total": total}


@router.get("/reports")
def all_reports(db: Db, user: Actor, status: str | None = None, limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    require_permission(user, "reports.manage", db)
    query = scope_query(db, user, select(CitizenReport), model=CitizenReport, permission="reports.manage")
    if status:
        query = query.where(CitizenReport.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(CitizenReport.created_at.desc()).offset(offset).limit(limit)).all()
    return {"items": [report_dict(row) for row in rows], "total": total}


@router.get("/reports/{report_id}")
def report_detail(report_id: str, db: Db, user: Actor):
    return report_dict(get_report(db, user, report_id))


@router.patch("/reports/{report_id}")
def update_report(report_id: str, body: ReportPatch, db: Db, user: Actor):
    row = get_report(db, user, report_id, manage=True)
    if body.status and body.status not in {"received", "triaged", "assigned", "in_progress", "resolved", "closed", "rejected"}:
        raise HTTPException(422, "Murojaat holati noto‘g‘ri")
    if body.assigned_to:
        assignee = db.get(User, body.assigned_to)
        if assignee is None or not assignee.is_active or assignee.employee_status != "verified":
            raise HTTPException(422, "Faqat faol tasdiqlangan xodim tayinlanishi mumkin")
        if row.region_id and assignee.region_id and assignee.region_id != row.region_id:
            raise HTTPException(403, "Xodim murojaat hududiga tayinlanmagan")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    row.closed_at = now() if row.status in {"resolved", "closed", "rejected"} else None
    note = Notification(user_id=row.user_id, title="Murojaat holati yangilandi", body="Murojaatingizdagi o‘zgarishni ilovada ko‘ring.",
                        kind="report_update", target_id=row.id, is_public=False)
    db.add(note)
    audit(db, user, "report.update", row.id, {"status": row.status})
    db.commit()
    from app.worker import enqueue_notification
    enqueue_notification(note.id)
    return report_dict(row)
