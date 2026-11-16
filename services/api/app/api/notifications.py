from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select

from app.api.infrastructure import Actor, Db
from app.core.policy import can_access, require_global_permission, require_permission
from app.models import DeviceRegistration, Notification, User
from app.services.registry import as_json, audit, now

router = APIRouter(tags=["Notifications"])


def notification_dict(row):
    return {key: as_json(getattr(row, key)) for key in ("id", "title", "body", "kind", "target_id", "is_public", "reviewed_by", "read_at", "created_at")}


@router.get("/notifications")
def list_notifications(db: Db, user: Actor, limit: int = Query(default=100, ge=1, le=500), include_pending: bool = False):
    public_clause = Notification.is_public.is_(True) & Notification.reviewed_by.is_not(None)
    if include_pending:
        require_global_permission(user, "settings.manage", db)
        public_clause = Notification.is_public.is_(True)
    query = select(Notification).where(or_(Notification.user_id == user.id, public_clause))
    rows = db.scalars(query.order_by(Notification.created_at.desc()).limit(limit)).all()
    return {"items": [notification_dict(row) for row in rows], "total": len(rows)}


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: str, db: Db, user: Actor):
    row = db.get(Notification, notification_id)
    if row is None or row.user_id != user.id:
        # Global announcements do not share a mutable read flag across accounts.
        raise HTTPException(404, "Shaxsiy bildirishnoma topilmadi")
    row.read_at = now()
    db.commit()
    return notification_dict(row)


class DeviceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=10, max_length=4096)
    platform: str = Field(default="android", pattern="^(android|web)$")
    device_id: str = Field(default="default", max_length=200)


@router.post("/notifications/devices")
def register_device(body: DeviceInput, db: Db, user: Actor):
    row = db.scalars(select(DeviceRegistration).where(DeviceRegistration.user_id == user.id,
        DeviceRegistration.device_id == body.device_id)).first()
    if row is None:
        row = DeviceRegistration(user_id=user.id, device_id=body.device_id, push_token=body.token, platform=body.platform)
        db.add(row)
    else:
        row.push_token = body.token
        row.platform = body.platform
        row.revoked_at = None
    db.commit()
    return {"registered": True}


@router.delete("/notifications/devices")
def unregister_device(body: DeviceInput, db: Db, user: Actor):
    for row in db.scalars(select(DeviceRegistration).where(DeviceRegistration.user_id == user.id,
                                                          DeviceRegistration.push_token == body.token)).all():
        row.revoked_at = now()
    db.commit()
    return {"registered": False}


class NotificationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=3000)
    is_public: bool = False
    user_id: str | None = None
    kind: str = Field(default="information", max_length=50)


@router.post("/notifications", status_code=201)
def create_notification(body: NotificationCreate, db: Db, user: Actor):
    require_permission(user, "settings.manage", db)
    if body.is_public:
        require_global_permission(user, "settings.manage", db)
        if body.user_id:
            raise HTTPException(422, "Ommaviy e’londa shaxsiy oluvchi belgilanmaydi")
    else:
        recipient = db.get(User, body.user_id) if body.user_id else None
        if recipient is None or not can_access(db, user, recipient, permission="settings.manage"):
            raise HTTPException(422, "Ruxsat etilgan shaxsiy bildirishnoma oluvchisini tanlang")
    row = Notification(title=body.title, body=body.body, is_public=body.is_public, user_id=body.user_id, kind=body.kind)
    db.add(row)
    db.flush()
    audit(db, user, "notification.create", row.id)
    db.commit()
    if not body.is_public:
        from app.worker import enqueue_notification
        enqueue_notification(row.id)
    return notification_dict(row)


@router.post("/notifications/{notification_id}/approve")
def approve_notification(notification_id: str, db: Db, user: Actor):
    require_global_permission(user, "settings.manage", db)
    row = db.get(Notification, notification_id)
    if row is None or not row.is_public:
        raise HTTPException(404, "Ommaviy e’lon topilmadi")
    row.reviewed_by = user.id
    audit(db, user, "notification.approve", row.id)
    db.commit()
    from app.worker import enqueue_notification
    enqueue_notification(row.id)
    return notification_dict(row)
