from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import timedelta
from typing import Any, Literal
from uuid import UUID, uuid4

import jwt
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select, text

from app.api.infrastructure import Actor, Db, ObjectCreate, ObjectPatch, live_gate
from app.core.config import settings
from app.core.policy import can_access, is_employee, require_permission, scope_query
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models import AuthSession, InfrastructureObject, SyncChange, SyncCounter, SyncOperation, User
from app.services.registry import audit, create_object, now, object_dict, update_object, visible_data

router = APIRouter(tags=["Offline synchronization"])


def check_epoch(user, epoch: int | None):
    if epoch is not None and epoch != user.policy_epoch:
        raise HTTPException(409, {"code": "POLICY_CHANGED", "message": "Ruxsatlar o‘zgardi. Keshni qulflang va qayta ruxsat oling.",
                                  "policy_epoch": user.policy_epoch, "reset_required": True})


@router.post("/sync/grant")
def grant(db: Db, user: Actor):
    require_permission(user, "infrastructure.read", db)
    issued = now()
    expires = issued + timedelta(hours=settings.offline_lease_hours)
    lease_id = str(uuid4())
    claims = {"sub": user.id, "type": "offline_grant", "jti": lease_id, "epoch": user.policy_epoch,
              "iat": issued, "exp": expires}
    token = jwt.encode(claims, settings.secret_key, algorithm="HS256")
    audit(db, user, "offline.grant", lease_id, {"hours": settings.offline_lease_hours})
    db.commit()
    return {"lease_id": lease_id, "token": token, "server_time": issued.isoformat(), "expires_at": expires.isoformat(),
            "policy_epoch": user.policy_epoch}


@router.get("/sync/changes")
def changes(db: Db, user: Actor, cursor: int = Query(default=0, ge=0), policy_epoch: int | None = None,
            limit: int = Query(default=200, ge=1, le=500)):
    require_permission(user, "infrastructure.read", db)
    check_epoch(user, policy_epoch)
    counter = db.get(SyncCounter, 1)
    high_water = counter.value if counter else 0
    if cursor > high_water:
        raise HTTPException(409, {"code": "CURSOR_RESET_REQUIRED", "reset_required": True, "message": "Sinxronlash kursori eskirgan"})
    events = db.scalars(select(SyncChange).where(SyncChange.cursor > cursor, SyncChange.cursor <= high_water)
                       .order_by(SyncChange.cursor).limit(limit)).all()
    items = []
    for event in events:
        obj = db.get(InfrastructureObject, event.object_id)
        if obj is None or not can_access(db, user, obj):
            continue
        if obj.deleted_at:
            items.append({"cursor": event.cursor, "object_id": obj.id, "operation": "delete"})
            continue
        try:
            data = visible_data(db, user, obj)
        except HTTPException:
            continue
        items.append({"cursor": event.cursor, "object_id": obj.id, "operation": "upsert", "data": data})
    next_cursor = events[-1].cursor if len(events) == limit else high_water
    return {"items": items, "next_cursor": next_cursor, "has_more": next_cursor < high_water,
            "policy_epoch": user.policy_epoch, "server_time": now().isoformat()}


class SyncItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: UUID
    entity_type: Literal["infrastructure"] = "infrastructure"
    action: Literal["create", "update"]
    object_id: str | None = None
    expected_version: int | None = Field(default=None, ge=1)
    data: dict[str, Any]


class SyncBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    policy_epoch: int
    device_id: str = Field(default="unknown", max_length=200)
    operations: list[SyncItem] = Field(min_length=1, max_length=100)


@router.post("/sync/batch")
def batch(body: SyncBatch, db: Db, user: Actor):
    require_permission(user, "infrastructure.write", db)
    check_epoch(user, body.policy_epoch)
    results = []
    for item in body.operations:
        db.refresh(user)
        if not user.is_active or not is_employee(user):
            raise HTTPException(403, "Xodim ruxsati bekor qilingan")
        check_epoch(user, body.policy_epoch)
        operation_id = str(item.operation_id)
        payload = item.model_dump(mode="json")
        try:
            canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
        except ValueError as exc:
            raise HTTPException(422, "Cheksiz texnik qiymat qabul qilinmaydi") from exc
        digest = hashlib.sha256(canonical.encode()).hexdigest()
        lock_id = int.from_bytes(hashlib.sha256(f"{user.id}:{operation_id}".encode()).digest()[:8], "big", signed=True)
        try:
            with db.begin_nested():
                db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_id})
                old = db.scalars(select(SyncOperation).where(SyncOperation.user_id == user.id, SyncOperation.operation_id == operation_id)).first()
                if old:
                    if old.payload_hash != digest:
                        raise HTTPException(409, {"code": "IDEMPOTENCY_MISMATCH", "message": "Operatsiya identifikatori boshqa mazmun bilan qayta yuborilgan"})
                    old_object_id = (old.result.get("data") or {}).get("id")
                    previous_object = db.get(InfrastructureObject, old_object_id) if old_object_id else None
                    if previous_object and not can_access(db, user, previous_object, write=True):
                        raise HTTPException(403, "Avvalgi natijaga ruxsat bekor qilingan")
                    result = old.result
                else:
                    if item.action == "create":
                        request = ObjectCreate.model_validate(item.data)
                        live_gate(request.is_synthetic)
                        values = request.model_dump()
                        values["organization_id"] = request.organization_id or user.organization_id
                        if not values["organization_id"]:
                            raise HTTPException(422, "Mas’ul tashkilot majburiy")
                        obj = create_object(db, user, values)
                    else:
                        if not item.object_id:
                            raise HTTPException(422, "Tahrir uchun object_id majburiy")
                        request = ObjectPatch.model_validate({**item.data, "expected_version": item.expected_version})
                        values = request.model_dump(exclude_unset=True, exclude={"expected_version"})
                        obj = update_object(db, user, item.object_id, values, item.expected_version)
                    result = {"operation_id": operation_id, "status": "success", "data": object_dict(obj)}
                    db.add(SyncOperation(user_id=user.id, operation_id=operation_id, device_id=body.device_id,
                                         payload_hash=digest, result=result, status="success"))
            db.commit()
        except (HTTPException, ValidationError) as exc:
            db.rollback()
            code = exc.status_code if isinstance(exc, HTTPException) else 422
            detail = exc.detail if isinstance(exc, HTTPException) else "Operatsiya maydonlari noto‘g‘ri"
            result = {"operation_id": operation_id, "status": "conflict" if code == 409 else "rejected",
                      "error": {"status_code": code, "detail": detail}}
        results.append(result)
    return {"results": results, "policy_epoch": user.policy_epoch, "server_time": now().isoformat()}


@router.get("/events")
async def events(request: Request, user: Actor, db: Db):
    require_permission(user, "infrastructure.read", db)
    user_id, epoch = user.id, user.policy_epoch
    claims = decode_token(request.headers["authorization"].split(" ", 1)[1])
    session_id, token_expiry = claims["sid"], claims["exp"]
    db.commit()  # Do not keep a transaction/pooled connection open for an idle stream.

    async def stream():
        previous = -1
        for _ in range(60):
            if await request.is_disconnected():
                break
            with SessionLocal() as db:
                current = db.get(User, user_id)
                session = db.get(AuthSession, session_id)
                if (current is None or not current.is_active or current.policy_epoch != epoch
                        or session is None or session.revoked_at is not None or session.expires_at <= now()
                        or token_expiry <= now().timestamp()):
                    yield "event: access_revoked\ndata: {}\n\n"
                    break
                counter = db.get(SyncCounter, 1)
                marker = counter.value if counter else 0
            if marker != previous:
                # No object ID or coordinate crosses this stream; refetch applies current policies.
                yield "event: refresh\ndata: {}\n\n"
                previous = marker
            else:
                yield ": heartbeat\n\n"
            await asyncio.sleep(2)
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
