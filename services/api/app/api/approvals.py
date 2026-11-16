from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.infrastructure import Actor, Db, Transition, change_state
from app.core.policy import require_permission, scope_query
from app.models import InfrastructureObject
from app.services.registry import object_dict

router = APIRouter(tags=["Approvals"])


@router.get("/approvals/pending")
def pending(db: Db, user: Actor, limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    require_permission(user, "infrastructure.review", db)
    query = scope_query(db, user, select(InfrastructureObject), permission="infrastructure.review").where(
        InfrastructureObject.deleted_at.is_(None), InfrastructureObject.lifecycle.in_(["submitted", "under_review", "approved"]))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(InfrastructureObject.updated_at).offset(offset).limit(limit)).all()
    return {"items": [object_dict(row) for row in rows], "total": total}


@router.post("/approvals/{object_id}/approve")
def approve(object_id: str, db: Db, user: Actor, body: Transition = Transition()):
    obj = change_state(db, user, object_id, "approve", body)
    db.commit()
    return object_dict(obj)


@router.post("/approvals/{object_id}/reject")
def reject(object_id: str, body: Transition, db: Db, user: Actor):
    obj = change_state(db, user, object_id, "reject", body)
    db.commit()
    return object_dict(obj)


@router.post("/approvals/{object_id}/requires-correction")
def correction(object_id: str, body: Transition, db: Db, user: Actor):
    obj = change_state(db, user, object_id, "requires_correction", body)
    db.commit()
    return object_dict(obj)
