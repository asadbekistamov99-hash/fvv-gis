from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import DateTime, case, delete, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.api.auth import get_current_user
from app.core.config import settings
from app.core.policy import can_access, require_permission, scope_query
from app.db.session import get_db
from app.models import InfrastructureObject, ObjectRevision, PublicObject
from app.services.registry import (audit, authorized_object, create_object, now, object_dict,
                                   publish_public, record_change, revision, update_object, visible_data, draft_author, draft_owner_clause)

router = APIRouter(tags=["Infrastructure"])
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[Any, Depends(get_current_user)]


class ObjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=250)
    description: str | None = Field(default=None, max_length=10000)
    category_id: str
    region_id: str
    district_id: str | None = None
    organization_id: str | None = None
    responsible_employee_id: str | None = None
    address: str | None = Field(default=None, max_length=400)
    geometry: dict[str, Any]
    operational_status: str = "unknown"
    sensitivity: Literal["public", "internal", "restricted", "confidential"] = "internal"
    passport: dict[str, Any] = Field(default_factory=dict)
    accuracy_m: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    survey_method: str | None = Field(default=None, max_length=120)
    survey_date: date | None = None
    data_source: str = Field(default="user_submission", max_length=255)
    is_synthetic: bool = True


class ObjectPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(ge=1)
    code: str | None = Field(default=None, min_length=2, max_length=80)
    name: str | None = Field(default=None, min_length=2, max_length=250)
    description: str | None = Field(default=None, max_length=10000)
    category_id: str | None = None
    region_id: str | None = None
    district_id: str | None = None
    organization_id: str | None = None
    responsible_employee_id: str | None = None
    address: str | None = Field(default=None, max_length=400)
    geometry: dict[str, Any] | None = None
    operational_status: str | None = None
    sensitivity: str | None = None
    passport: dict[str, Any] | None = None
    accuracy_m: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    survey_method: str | None = Field(default=None, max_length=120)
    survey_date: date | None = None


class Transition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int | None = Field(default=None, ge=1)
    comment: str | None = Field(default=None, max_length=4000)
    reason: str | None = Field(default=None, max_length=4000)


def live_gate(is_synthetic: bool):
    if not (is_synthetic and settings.is_development) and not (settings.live_intake_enabled and settings.live_policy_ready):
        raise HTTPException(503, {"code": "LIVE_DATA_DISABLED", "message": "Haqiqiy ma’lumot qabul qilish operator siyosati tasdiqlangandan so‘ng ochiladi"})


@router.get("/infrastructure")
def list_objects(db: Db, user: Actor, category_id: str | None = None, region_id: str | None = None,
                 district_id: str | None = None, status: str | None = None, lifecycle: str | None = None,
                 search: str | None = Query(default=None, max_length=200),
                 limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    require_permission(user, "infrastructure.read", db)
    published = aliased(ObjectRevision)
    query = scope_query(db, user, select(InfrastructureObject).outerjoin(
        published, published.id == InfrastructureObject.published_revision_id
    )).where(InfrastructureObject.deleted_at.is_(None))
    review_ids = scope_query(db, user, select(InfrastructureObject.id), permission="infrastructure.review")
    sees_draft = or_(draft_owner_clause(user.id), InfrastructureObject.id.in_(review_ids))
    query = query.where(or_(draft_owner_clause(user.id),
                           InfrastructureObject.published_revision_id.is_not(None), InfrastructureObject.id.in_(review_ids)))
    for field, value in (("category_id", category_id), ("region_id", region_id), ("district_id", district_id),
                         ("operational_status", status), ("lifecycle", lifecycle)):
        if value:
            visible_value = case((sees_draft, getattr(InfrastructureObject, field)),
                                 else_=published.data[field].as_string())
            query = query.where(visible_value == value)
    if search:
        name = case((sees_draft, InfrastructureObject.name), else_=published.data["name"].as_string())
        code = case((sees_draft, InfrastructureObject.code), else_=published.data["code"].as_string())
        query = query.where(or_(name.ilike(f"%{search}%"), code.ilike(f"%{search}%")))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    updated = case((sees_draft, InfrastructureObject.updated_at),
                   else_=published.data["updated_at"].as_string().cast(DateTime(timezone=True)))
    rows = db.scalars(query.order_by(updated.desc(), InfrastructureObject.id).offset(offset).limit(limit)).all()
    return {"items": [visible_data(db, user, obj) for obj in rows if can_access(db, user, obj)], "total": total}


@router.post("/infrastructure", status_code=201)
def add_object(body: ObjectCreate, db: Db, user: Actor):
    live_gate(body.is_synthetic)
    data = body.model_dump()
    data["organization_id"] = body.organization_id or user.organization_id
    if not data["organization_id"]:
        raise HTTPException(422, "Mas’ul tashkilot majburiy")
    obj = create_object(db, user, data)
    db.commit()
    return visible_data(db, user, obj)


@router.get("/infrastructure/{object_id}")
def get_object(object_id: str, db: Db, user: Actor):
    require_permission(user, "infrastructure.read", db)
    obj = authorized_object(db, user, object_id)
    audit(db, user, "infrastructure.read", obj.id)
    db.commit()
    return visible_data(db, user, obj)


@router.patch("/infrastructure/{object_id}")
def patch_object(object_id: str, body: ObjectPatch, db: Db, user: Actor):
    data = body.model_dump(exclude_unset=True, exclude={"expected_version"})
    for key in ("name", "code", "category_id", "region_id", "organization_id", "geometry", "passport", "operational_status", "sensitivity"):
        if key in data and data[key] is None:
            raise HTTPException(422, f"{key} bo‘sh bo‘lmaydi")
    obj = update_object(db, user, object_id, data, body.expected_version)
    db.commit()
    return object_dict(obj)


@router.get("/infrastructure/{object_id}/history")
def history(object_id: str, db: Db, user: Actor):
    obj = authorized_object(db, user, object_id)
    visible_data(db, user, obj)
    rows = db.scalars(select(ObjectRevision).where(ObjectRevision.object_id == object_id).order_by(ObjectRevision.version.desc())).all()
    if draft_author(db, obj) != user.id and not can_access(db, user, obj, permission="infrastructure.review"):
        rows = [row for row in rows if row.state == "published"]
    return {"items": [{"id": row.id, "version": row.version, "state": row.state,
                        "created_at": row.created_at.isoformat(), "created_by": row.created_by, "data": row.data} for row in rows], "total": len(rows)}


def change_state(db, user, object_id: str, action: str, body: Transition):
    from app.models import ApprovalRequest
    from app.services.registry import check_version
    permission = "infrastructure.review" if action in {"review", "approve", "reject", "requires_correction"} else "infrastructure.publish" if action == "publish" else "infrastructure.write"
    require_permission(user, permission, db)
    obj = db.execute(select(InfrastructureObject).where(InfrastructureObject.id == object_id).with_for_update()).scalar_one_or_none()
    if obj is None or not can_access(db, user, obj, permission=permission):
        raise HTTPException(404, "Obyekt topilmadi")
    if body.expected_version is not None:
        check_version(obj, body.expected_version)
    transitions = {"submit": ({"draft", "requires_correction", "rejected"}, "submitted"),
                   "review": ({"submitted"}, "under_review"),
                   "approve": ({"under_review"}, "approved"),
                   "publish": ({"approved"}, "published"),
                   "reject": ({"submitted", "under_review"}, "rejected"),
                   "requires_correction": ({"submitted", "under_review"}, "requires_correction"),
                   "archive": ({"draft", "published", "approved", "rejected", "requires_correction"}, "archived"),
                   "restore": ({"archived"}, "draft")}
    allowed, target = transitions[action]
    if obj.lifecycle not in allowed:
        raise HTTPException(409, f"{obj.lifecycle} holatidan {target} holatiga o‘tib bo‘lmaydi")
    if action in {"review", "approve", "publish", "reject", "requires_correction"} and user.id == draft_author(db, obj):
        raise HTTPException(403, "Muallif o‘z obyektini tasdiqlashi yoki ko‘rib chiqishi mumkin emas")
    if action in {"reject", "requires_correction"} and not (body.reason or body.comment):
        raise HTTPException(422, "Rad etish yoki tuzatish sababi majburiy")
    obj.lifecycle = target
    if action == "archive":
        obj.deleted_at = now()
        db.execute(delete(PublicObject).where(PublicObject.object_id == obj.id))
    if action == "restore":
        obj.deleted_at = None
        obj.published_revision_id = None
    if action == "approve":
        obj.verification_status = "verified"
    row = revision(db, obj, user)
    if action == "submit":
        db.add(ApprovalRequest(object_id=obj.id, revision_id=row.id, requested_by=user.id, status="submitted"))
    else:
        approval = db.scalars(select(ApprovalRequest).where(ApprovalRequest.object_id == obj.id).order_by(ApprovalRequest.created_at.desc()).limit(1)).first()
        if approval:
            approval.status = target
            if action in {"approve", "reject", "requires_correction"}:
                approval.reviewed_by = user.id
            approval.note = body.reason or body.comment
    if action == "publish":
        obj.published_revision_id = row.id
    audit(db, user, f"infrastructure.{action}", obj.id, {"version": obj.version})
    return obj


@router.post("/infrastructure/{object_id}/submit")
def submit(object_id: str, db: Db, user: Actor, body: Transition = Transition()):
    obj = change_state(db, user, object_id, "submit", body)
    db.commit()
    return object_dict(obj)


@router.post("/infrastructure/{object_id}/review")
def review(object_id: str, db: Db, user: Actor, body: Transition = Transition()):
    obj = change_state(db, user, object_id, "review", body)
    db.commit()
    return object_dict(obj)


@router.post("/infrastructure/{object_id}/publish")
def publish(object_id: str, db: Db, user: Actor, body: Transition = Transition()):
    obj = change_state(db, user, object_id, "publish", body)
    db.commit()
    return object_dict(obj)


@router.post("/infrastructure/{object_id}/publish-public")
def publish_for_citizens(object_id: str, db: Db, user: Actor):
    require_permission(user, "infrastructure.publish", db)
    obj = authorized_object(db, user, object_id, permission="infrastructure.publish")
    if user.id == obj.created_by:
        raise HTTPException(403, "Ommaviy nashr mustaqil tekshiruvni talab qiladi")
    projection = publish_public(db, obj, user)
    audit(db, user, "infrastructure.publish_public", obj.id)
    db.commit()
    return {"id": projection.id, "status": "published_public"}


@router.delete("/infrastructure/{object_id}")
def archive(object_id: str, db: Db, user: Actor, body: Transition = Transition()):
    obj = change_state(db, user, object_id, "archive", body)
    db.commit()
    return object_dict(obj)


@router.post("/infrastructure/{object_id}/restore")
def restore(object_id: str, db: Db, user: Actor, body: Transition = Transition()):
    obj = change_state(db, user, object_id, "restore", body)
    db.commit()
    return object_dict(obj)
