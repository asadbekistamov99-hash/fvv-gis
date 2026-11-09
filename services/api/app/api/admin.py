from __future__ import annotations

import csv
import io
from types import SimpleNamespace
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, func, select

from app.api.gis import category_dict
from app.api.infrastructure import Actor, Db
from app.core.config import settings
from app.core.policy import EMPLOYEE_ROLES, can_access, effective_roles, require_global_permission, require_permission, scope_query
from app.models import (AuditLog, AuthSession, CategorySchemaVersion, CitizenReport, DeviceRegistration,
    EmployeeVerification, InfrastructureCategory, InfrastructureObject, Notification, Organization,
    RoleAssignment, User)
from app.services.registry import as_json, audit, now, visible_data

router = APIRouter(tags=["Administration"])


def count(db, query):
    return db.scalar(select(func.count()).select_from(query.subquery())) or 0


@router.get("/admin/dashboard")
def dashboard(db: Db, user: Actor):
    require_permission(user, "infrastructure.review", db)
    objects = scope_query(db, user, select(InfrastructureObject), permission="infrastructure.review").where(InfrastructureObject.deleted_at.is_(None))
    rows = db.scalars(objects).all()
    by_category: dict[str, int] = {}
    by_region: dict[str, int] = {}
    for row in rows:
        by_category[row.category_id] = by_category.get(row.category_id, 0) + 1
        by_region[row.region_id] = by_region.get(row.region_id, 0) + 1
    employee_query = scope_query(db, user, select(User), model=User, permission="employees.verify").where(User.is_active.is_(True), User.employee_status == "verified")
    report_query = scope_query(db, user, select(CitizenReport), model=CitizenReport, permission="reports.manage")
    return {"total_objects": len(rows), "working_objects": sum(row.operational_status == "working" for row in rows),
            "faulty_objects": sum(row.operational_status == "faulty" for row in rows),
            "pending_approvals": sum(row.lifecycle in {"submitted", "under_review", "approved"} for row in rows),
            "active_employees": count(db, employee_query), "citizen_reports": count(db, report_query),
            "by_category": [{"category_id": key, "count": value} for key, value in by_category.items()],
            "by_region": [{"region_id": key, "count": value} for key, value in by_region.items()],
            "quality": {"missing_accuracy": sum(row.accuracy_m is None for row in rows),
                        "unverified": sum(row.verification_status != "verified" for row in rows)}}


@router.get("/admin/employee-verifications")
def verifications(db: Db, user: Actor, status: str | None = "pending_verification"):
    require_permission(user, "employees.verify", db)
    query = scope_query(db, user, select(EmployeeVerification), model=EmployeeVerification, permission="employees.verify")
    if status:
        query = query.where(EmployeeVerification.status == status)
    rows = db.scalars(query.order_by(EmployeeVerification.created_at)).all()
    fields = ("id", "user_id", "full_name", "organization_id", "organization_name", "department", "region_id", "district_id",
              "verification_reference", "requested_role", "status", "reviewed_by", "reviewed_at", "review_note", "created_at")
    return {"items": [{**{key: as_json(getattr(row, key)) for key in fields}, "phone": db.get(User, row.user_id).phone} for row in rows], "total": len(rows)}


class VerificationDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str = "verified_employee"
    region_id: str | None = None
    district_id: str | None = None
    organization_id: str | None = None
    reference: str | None = Field(default=None, max_length=200)
    reason: str | None = Field(default=None, max_length=4000)
    max_sensitivity: str = "internal"
    categories: list[str] = Field(default_factory=list, max_length=100)


def verification_row(db, user, verification_id):
    query = scope_query(db, user, select(EmployeeVerification), model=EmployeeVerification, permission="employees.verify").where(EmployeeVerification.id == verification_id)
    row = db.scalars(query.with_for_update()).first()
    if row is None:
        raise HTTPException(404, "Ariza topilmadi")
    if row.user_id == user.id:
        raise HTTPException(403, "O‘z arizangizni tasdiqlashingiz mumkin emas")
    if row.status != "pending_verification":
        raise HTTPException(409, "Ariza allaqachon ko‘rib chiqilgan")
    return row


def check_assignment_scope(db, user, *, role, region_id, district_id, organization_id, max_sensitivity, categories):
    if role not in EMPLOYEE_ROLES:
        raise HTTPException(422, "Xodim roli noto‘g‘ri")
    if role in {"system_administrator", "super_administrator"} and "super_administrator" not in effective_roles(db, user):
        raise HTTPException(403, "Administrator rolini faqat super administrator tayinlaydi")
    if max_sensitivity not in {"public", "internal", "restricted", "confidential"}:
        raise HTTPException(422, "Maxfiylik darajasi noto‘g‘ri")
    for category in categories or [None]:
        candidate = SimpleNamespace(id=None, region_id=region_id, district_id=district_id,
            organization_id=organization_id, sensitivity=max_sensitivity, category_id=category)
        if not can_access(db, user, candidate, permission="employees.verify"):
            raise HTTPException(403, "O‘zingizdan kengroq hudud yoki maxfiylik ruxsatini bera olmaysiz")
    from app.models import District, Region
    if region_id and db.get(Region, region_id) is None:
        raise HTTPException(422, "Hudud topilmadi")
    if district_id:
        district = db.get(District, district_id)
        if district is None or (region_id and district.region_id != region_id):
            raise HTTPException(422, "Tuman hududga tegishli emas")
    if organization_id and db.get(Organization, organization_id) is None:
        raise HTTPException(422, "Tashkilot topilmadi")
    for category in categories:
        if db.get(InfrastructureCategory, category) is None:
            raise HTTPException(422, "Kategoriya topilmadi")


def manageable_assignment(db, user, assignment):
    for category in assignment.categories or [None]:
        candidate = SimpleNamespace(id=None, region_id=assignment.region_id, district_id=assignment.district_id,
            organization_id=assignment.organization_id, sensitivity=assignment.max_sensitivity, category_id=category)
        if not can_access(db, user, candidate, permission="employees.verify"):
            return False
    return True


def protect_existing_grants(db, user, person):
    if person.role in {"system_administrator", "super_administrator"} and "super_administrator" not in effective_roles(db, user):
        raise HTTPException(403, "Administrator ruxsatlarini faqat super administrator o‘zgartiradi")
    assignments = db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == person.id)).all()
    if any(not manageable_assignment(db, user, assignment) for assignment in assignments):
        raise HTTPException(403, "Xodimning ayrim ruxsatlari boshqaruv hududingizdan tashqarida")


def revoke_sessions(db, person):
    person.policy_epoch += 1
    for session in db.scalars(select(AuthSession).where(AuthSession.user_id == person.id, AuthSession.revoked_at.is_(None))).all():
        session.revoked_at = now()
    for device in db.scalars(select(DeviceRegistration).where(DeviceRegistration.user_id == person.id, DeviceRegistration.revoked_at.is_(None))).all():
        device.revoked_at = now()


@router.post("/admin/employee-verifications/{verification_id}/approve")
def approve_employee(verification_id: str, body: VerificationDecision, db: Db, user: Actor):
    require_permission(user, "employees.verify", db)
    row = verification_row(db, user, verification_id)
    if not (body.reference or row.verification_reference):
        raise HTTPException(422, "Vakolatli tekshiruv ma’lumotnomasi majburiy")
    region_id = body.region_id or row.region_id
    organization_id = body.organization_id or row.organization_id
    district_id = body.district_id or row.district_id
    if not organization_id:
        raise HTTPException(422, "Tasdiqlangan tashkilotni tanlang")
    check_assignment_scope(db, user, role=body.role, region_id=region_id, district_id=district_id,
                           organization_id=organization_id, max_sensitivity=body.max_sensitivity, categories=body.categories)
    person = db.get(User, row.user_id)
    person.role, person.employee_status = body.role, "verified"
    person.region_id, person.district_id, person.organization_id = region_id, district_id, organization_id
    db.execute(delete(RoleAssignment).where(RoleAssignment.user_id == person.id))
    db.add(RoleAssignment(user_id=person.id, role_id=body.role, region_id=region_id, district_id=district_id,
                         organization_id=organization_id, max_sensitivity=body.max_sensitivity, categories=body.categories, granted_by=user.id))
    row.status, row.reviewed_by, row.reviewed_at = "approved", user.id, now()
    row.verification_reference, row.review_note = body.reference or row.verification_reference, body.reason
    revoke_sessions(db, person)
    audit(db, user, "employee.approve", person.id, {"role": body.role})
    db.commit()
    return {"id": row.id, "user_id": person.id, "status": row.status, "role": person.role}


@router.post("/admin/employee-verifications/{verification_id}/reject")
def reject_employee(verification_id: str, body: VerificationDecision, db: Db, user: Actor):
    require_permission(user, "employees.verify", db)
    row = verification_row(db, user, verification_id)
    if not body.reason:
        raise HTTPException(422, "Rad etish sababi majburiy")
    row.status, row.reviewed_by, row.reviewed_at, row.review_note = "rejected", user.id, now(), body.reason
    audit(db, user, "employee.reject", row.user_id)
    db.commit()
    return {"id": row.id, "status": row.status}


@router.get("/admin/users")
def employees(db: Db, user: Actor):
    require_permission(user, "employees.verify", db)
    query = scope_query(db, user, select(User), model=User, permission="employees.verify")
    rows = db.scalars(query.order_by(User.created_at.desc())).all()
    items = []
    for row in rows:
        item = {key: as_json(getattr(row, key)) for key in ("id", "phone", "full_name", "role", "employee_status", "region_id", "district_id", "organization_id", "is_active", "policy_epoch")}
        assignments = db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == row.id)).all()
        visible = [assignment for assignment in assignments if manageable_assignment(db, user, assignment)]
        fields = ("id", "role_id", "region_id", "district_id", "organization_id", "max_sensitivity", "categories", "assigned_object_ids")
        item["assignments"] = [{key: as_json(getattr(assignment, key)) for key in fields} for assignment in visible]
        item["assignments_complete"] = len(visible) == len(assignments)
        items.append(item)
    return {"items": items, "total": len(items)}


@router.post("/admin/users/{user_id}/suspend")
def suspend(user_id: str, db: Db, user: Actor):
    require_permission(user, "employees.verify", db)
    person = db.scalars(scope_query(db, user, select(User), model=User, permission="employees.verify").where(User.id == user_id)).first()
    if person is None:
        raise HTTPException(404, "Xodim topilmadi")
    if person.id == user.id or (person.role == "super_administrator" and "super_administrator" not in effective_roles(db, user)):
        raise HTTPException(403, "Bu hisobni to‘xtatish mumkin emas")
    protect_existing_grants(db, user, person)
    person.is_active = False
    revoke_sessions(db, person)
    audit(db, user, "employee.suspend", person.id)
    db.commit()
    return {"id": person.id, "is_active": False}


@router.post("/admin/users/{user_id}/roles")
def assign_role(user_id: str, body: VerificationDecision, db: Db, user: Actor):
    require_permission(user, "employees.verify", db)
    person = db.scalars(scope_query(db, user, select(User), model=User, permission="employees.verify").where(User.id == user_id)).first()
    if person is None or person.employee_status != "verified":
        raise HTTPException(404, "Tasdiqlangan xodim topilmadi")
    if person.id == user.id:
        raise HTTPException(403, "O‘z ruxsatlaringizni o‘zgartirish mumkin emas")
    protect_existing_grants(db, user, person)
    check_assignment_scope(db, user, role=body.role, region_id=body.region_id, district_id=body.district_id,
        organization_id=body.organization_id, max_sensitivity=body.max_sensitivity, categories=body.categories)
    db.execute(delete(RoleAssignment).where(RoleAssignment.user_id == person.id))
    db.add(RoleAssignment(user_id=person.id, role_id=body.role, region_id=body.region_id, district_id=body.district_id,
                         organization_id=body.organization_id, categories=body.categories,
                         max_sensitivity=body.max_sensitivity, granted_by=user.id))
    person.role, person.region_id, person.district_id, person.organization_id = body.role, body.region_id, body.district_id, body.organization_id
    revoke_sessions(db, person)
    audit(db, user, "employee.roles", person.id, {"role": body.role})
    db.commit()
    return {"id": person.id, "role": person.role, "policy_epoch": person.policy_epoch}


@router.get("/admin/audit")
def audits(db: Db, user: Actor, limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    require_permission(user, "audit.read", db)
    # Audit contains cross-domain events; only global audit assignments may read the global ledger.
    assignments = db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)).all()
    global_audit = any(a.region_id is None and a.district_id is None and a.organization_id is None and
                       a.role_id in {"system_administrator", "super_administrator"} for a in assignments)
    query = select(AuditLog)
    if not global_audit:
        ids = scope_query(db, user, select(User.id), model=User, permission="audit.read")
        query = query.where(AuditLog.actor_id.in_(ids))
    total = count(db, query)
    rows = db.scalars(query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)).all()
    return {"items": [{key: as_json(getattr(row, key)) for key in ("id", "actor_id", "action", "target_type", "target_id", "outcome", "details", "created_at")} for row in rows], "total": total}


@router.get("/admin/categories/{category_id}")
def get_category(category_id: str, db: Db, user: Actor):
    require_permission(user, "settings.manage", db)
    row = db.get(InfrastructureCategory, category_id)
    if row is None:
        raise HTTPException(404, "Kategoriya topilmadi")
    return category_dict(row)


class CategoryPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(ge=1)
    name_uz: str | None = Field(default=None, min_length=2, max_length=120)
    name_ru: str | None = Field(default=None, min_length=2, max_length=120)
    name_en: str | None = Field(default=None, min_length=2, max_length=120)
    passport_schema: dict[str, Any] | None = None
    geometry_types: list[str] | None = None
    color: str | None = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")


@router.patch("/admin/categories/{category_id}")
def patch_category(category_id: str, body: CategoryPatch, db: Db, user: Actor):
    require_global_permission(user, "settings.manage", db)
    row = db.scalars(select(InfrastructureCategory).where(InfrastructureCategory.id == category_id).with_for_update()).first()
    if row is None:
        raise HTTPException(404, "Kategoriya topilmadi")
    if body.expected_version != row.schema_version:
        raise HTTPException(409, "Kategoriya sxemasi boshqa administrator tomonidan o‘zgartirilgan")
    if body.geometry_types and not set(body.geometry_types) <= {"Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"}:
        raise HTTPException(422, "Geometriya turi noto‘g‘ri")
    if body.passport_schema is not None:
        extensions = body.passport_schema.get("extensions", {})
        if not isinstance(extensions, dict) or len(extensions) > 100:
            raise HTTPException(422, "Qo‘shimcha sxema noto‘g‘ri")
        for name, spec in extensions.items():
            if not isinstance(name, str) or len(name) > 100 or not isinstance(spec, dict) or spec.get("type") not in {"number", "integer", "string", "boolean"}:
                raise HTTPException(422, "Qo‘shimcha maydon turlangan bo‘lishi kerak")
        previous = row.passport_schema.get("extensions", {})
        if any(name not in extensions or previous[name].get("type") != extensions[name].get("type") for name in previous):
            raise HTTPException(409, "Mavjud maydonni o‘chirish yoki turini almashtirish alohida ma’lumot migratsiyasini talab qiladi")
    for key, value in body.model_dump(exclude_unset=True, exclude={"expected_version"}).items():
        if value is not None:
            setattr(row, key, value)
    row.schema_version += 1
    db.add(CategorySchemaVersion(category_id=row.id, version=row.schema_version, definition=row.passport_schema))
    audit(db, user, "category.update", row.id, {"version": row.schema_version})
    db.commit()
    return category_dict(row)


@router.get("/admin/backups/status")
def backup_status(db: Db, user: Actor):
    require_permission(user, "settings.manage", db)
    return {"configured": settings.backup_retention_days is not None and settings.retention_policy_approved,
            "last_verified_at": None, "status": "verification_required", "retention_days": settings.backup_retention_days,
            "message": "Zaxira tiklash dalili APIga hali taqdim etilmagan. Serverdagi zaxiralash jurnalini tekshiring."}


@router.get("/exports/infrastructure.csv")
def export_csv(db: Db, user: Actor):
    require_permission(user, "exports.create", db)
    query = scope_query(db, user, select(InfrastructureObject), permission="exports.create").where(InfrastructureObject.deleted_at.is_(None))
    output = io.StringIO()
    columns = ["id", "code", "name", "category_id", "region_id", "operational_status", "version", "updated_at"]
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    rows = db.scalars(query).all()
    for row in rows:
        try:
            data = visible_data(db, user, row)
        except HTTPException:
            continue
        safe = {key: data.get(key) for key in columns}
        for key, value in safe.items():
            if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")):
                safe[key] = "'" + value
        writer.writerow(safe)
    audit(db, user, "export.infrastructure", None, {"format": "csv"})
    db.commit()
    return Response("\ufeff" + output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=infrastructure.csv", "Cache-Control": "no-store"})
