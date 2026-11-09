from __future__ import annotations

import hashlib
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import select, text

from app.api.infrastructure import Actor, Db
from app.api.reports import get_report
from app.core.config import settings
from app.core.policy import can_access, require_permission
from app.models import ObjectAttachment, ObjectRevision
from app.services.registry import as_json, audit, authorized_object, draft_author, visible_data
from app.services.storage import inspect_content, queue_scan, read_private, save_private

router = APIRouter(tags=["Attachments"])


def attachment_dict(row):
    return {key: as_json(getattr(row, key)) for key in ("id", "object_id", "report_id", "filename", "content_type", "size_bytes", "scan_status", "created_at")}


def accessible(db, user, row):
    if row is None or row.deleted_at:
        raise HTTPException(404, "Fayl topilmadi")
    if row.object_id:
        obj = authorized_object(db, user, row.object_id)
        visible_data(db, user, obj)
        if draft_author(db, obj) != user.id and not can_access(db, user, obj, permission="infrastructure.review"):
            published = db.get(ObjectRevision, obj.published_revision_id)
            if published is None or row.created_at > published.created_at:
                raise HTTPException(404, "Fayl topilmadi")
    elif row.report_id:
        get_report(db, user, row.report_id)
    else:
        raise HTTPException(404, "Fayl topilmadi")


@router.post("/attachments", status_code=201)
def upload_attachment(db: Db, user: Actor, file: UploadFile = File(), object_id: str | None = Form(default=None), report_id: str | None = Form(default=None)):
    if bool(object_id) == bool(report_id):
        raise HTTPException(422, "Fayl aynan bitta obyekt yoki murojaatga tegishli bo‘lishi kerak")
    if object_id:
        require_permission(user, "infrastructure.write", db)
        authorized_object(db, user, object_id, write=True)
    else:
        get_report(db, user, report_id)
    content = file.file.read(settings.upload_max_bytes + 1)
    detected = inspect_content(content, file.content_type)
    digest = hashlib.sha256(content).hexdigest()
    lock_key = int.from_bytes(hashlib.sha256(f"attachment:{user.id}:{object_id}:{report_id}:{digest}".encode()).digest()[:8], "big", signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
    existing = db.scalar(select(ObjectAttachment).where(
        ObjectAttachment.uploaded_by == user.id, ObjectAttachment.object_id == object_id,
        ObjectAttachment.report_id == report_id, ObjectAttachment.sha256 == digest,
        ObjectAttachment.deleted_at.is_(None),
    ))
    if existing:
        return attachment_dict(existing)
    attachment_id = str(uuid4())
    key = f"quarantine/{attachment_id}"
    filename = Path((file.filename or "document").replace("\\", "/")).name[:255]
    save_private(key, content, detected)
    row = ObjectAttachment(id=attachment_id, object_id=object_id, report_id=report_id, uploaded_by=user.id,
                           filename=filename, content_type=detected, size_bytes=len(content), storage_key=key,
                           sha256=digest, scan_status="quarantined")
    db.add(row)
    audit(db, user, "attachment.upload", row.id, {"size_bytes": len(content), "content_type": detected})
    db.commit()
    queue_scan(row.id)
    return attachment_dict(row)


@router.get("/attachments/{attachment_id}")
def attachment_info(attachment_id: str, db: Db, user: Actor):
    row = db.get(ObjectAttachment, attachment_id)
    accessible(db, user, row)
    return attachment_dict(row)


@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: str, db: Db, user: Actor):
    row = db.get(ObjectAttachment, attachment_id)
    accessible(db, user, row)
    if row.scan_status != "clean":
        raise HTTPException(423, "Fayl xavfsizlik tekshiruvidan o‘tmaguncha yopiq qoladi")
    content = read_private(row.storage_key)
    audit(db, user, "attachment.download", row.id)
    db.commit()
    return Response(content, media_type=row.content_type, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
                     "Content-Disposition": f"attachment; filename*=UTF-8''{quote(row.filename)}"})


@router.get("/infrastructure/{object_id}/attachments")
def object_attachments(object_id: str, db: Db, user: Actor):
    obj = authorized_object(db, user, object_id)
    visible_data(db, user, obj)
    query = select(ObjectAttachment).where(ObjectAttachment.object_id == object_id, ObjectAttachment.deleted_at.is_(None))
    if draft_author(db, obj) != user.id and not can_access(db, user, obj, permission="infrastructure.review"):
        published = db.get(ObjectRevision, obj.published_revision_id)
        if published is None:
            raise HTTPException(404, "Obyekt topilmadi")
        query = query.where(ObjectAttachment.created_at <= published.created_at)
    rows = db.scalars(query.order_by(ObjectAttachment.created_at.desc())).all()
    return {"items": [attachment_dict(row) for row in rows], "total": len(rows)}


@router.get("/reports/{report_id}/attachments")
def report_attachments(report_id: str, db: Db, user: Actor):
    get_report(db, user, report_id)
    rows = db.scalars(select(ObjectAttachment).where(ObjectAttachment.report_id == report_id, ObjectAttachment.deleted_at.is_(None))).all()
    return {"items": [attachment_dict(row) for row in rows], "total": len(rows)}
