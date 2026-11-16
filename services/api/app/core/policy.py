"""Server-loaded role permissions and resource scopes; client claims never grant access."""
from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import InfrastructureObject, RoleAssignment, RolePermission, User

EMPLOYEE_ROLES = {"verified_employee", "regional_supervisor", "infrastructure_inspector", "data_reviewer",
                  "system_administrator", "super_administrator"}
ADMIN_ROLES = {"system_administrator", "super_administrator"}
SENSITIVITY = {"public": 0, "internal": 1, "restricted": 2, "confidential": 3}
ROLE_PERMISSIONS = {
    "citizen": {"reports.create"},
    "pending_employee": {"reports.create"},
    "verified_employee": {"infrastructure.read", "infrastructure.write", "inspections.create", "reports.create"},
    "infrastructure_inspector": {"infrastructure.read", "infrastructure.write", "inspections.create", "reports.create"},
    "regional_supervisor": {"infrastructure.read", "infrastructure.write", "infrastructure.review", "infrastructure.publish",
                            "inspections.create", "reports.create", "reports.manage", "routes.approve", "exports.create"},
    "data_reviewer": {"infrastructure.read", "infrastructure.review", "infrastructure.publish", "inspections.create", "reports.create"},
    "system_administrator": {"infrastructure.read", "infrastructure.write", "infrastructure.review", "infrastructure.publish",
                             "inspections.create", "reports.create", "reports.manage", "routes.approve", "exports.create",
                             "employees.verify", "audit.read", "settings.manage"},
}
ROLE_PERMISSIONS["super_administrator"] = set(ROLE_PERMISSIONS["system_administrator"])


def is_employee(user: User) -> bool:
    return bool(user.is_active and user.employee_status == "verified" and user.role in EMPLOYEE_ROLES)


def is_admin(user: User) -> bool:
    return is_employee(user) and user.role in ADMIN_ROLES


def effective_roles(db: Session, user: User) -> set[str]:
    if not user.is_active:
        return set()
    if not is_employee(user):
        return {"pending_employee" if user.employee_status == "pending_verification" else "citizen"}
    assignments = db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id)).all()
    return {a.role_id for a in assignments if a.role_id in EMPLOYEE_ROLES} or {user.role}


def require_permission(user: User, permission: str, db: Session) -> None:
    roles = effective_roles(db, user)
    # Database mappings allow operator configuration; built-in mapping is seeded during migration/bootstrap.
    mapped = set(db.scalars(select(RolePermission.permission_id).where(RolePermission.role_id.in_(roles))).all())
    if permission not in mapped:
        raise HTTPException(403, detail={"code": "permission_denied", "message": "Bu amal uchun ruxsat yo‘q"})


def require_global_permission(user: User, permission: str, db: Session) -> None:
    require_permission(user, permission, db)
    roles = set(db.scalars(select(RolePermission.role_id).where(RolePermission.permission_id == permission)))
    if not any(a.role_id in roles and not any((a.region_id, a.district_id, a.organization_id,
                a.categories, a.assigned_object_ids)) for a in assignments_for(db, user)):
        raise HTTPException(403, "Bu amal barcha hududlar uchun alohida ruxsat talab qiladi")


def assignments_for(db: Session, user: User):
    if not is_employee(user):
        return []
    return db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == user.id,
                                                   RoleAssignment.role_id.in_(EMPLOYEE_ROLES))).all()


def _scope_clause(assignment, model):
    clauses = []
    for name in ("region_id", "district_id", "organization_id"):
        value = getattr(assignment, name, None)
        if value is not None and hasattr(model, name):
            clauses.append(getattr(model, name) == value)
    if getattr(assignment, "categories", None) and hasattr(model, "category_id"):
        clauses.append(model.category_id.in_(assignment.categories))
    if hasattr(model, "sensitivity"):
        allowed = [s for s, rank in SENSITIVITY.items() if rank <= SENSITIVITY.get(assignment.max_sensitivity, 1)]
        clauses.append(model.sensitivity.in_(allowed))
    if getattr(assignment, "assigned_object_ids", None) and hasattr(model, "id"):
        clauses.append(model.id.in_(assignment.assigned_object_ids))
    return and_(*clauses) if clauses else True


def scope_query(db: Session, user: User, query, model=InfrastructureObject, permission="infrastructure.read"):
    if not is_employee(user):
        return query.where(False) if hasattr(query, "where") else query.filter(False)
    permitted_roles = set(db.scalars(select(RolePermission.role_id).where(
        RolePermission.permission_id == permission)).all())
    assignments = [a for a in assignments_for(db, user) if a.role_id in permitted_roles]
    # A privileged role without a server-side assignment grants no infrastructure scope.
    clause = or_(*[_scope_clause(a, model) for a in assignments]) if assignments else False
    return query.where(clause) if hasattr(query, "where") else query.filter(clause)


def can_access(db: Session, user: User, obj, write: bool = False, permission: str | None = None) -> bool:
    if not is_employee(user):
        return False
    permission = permission or ("infrastructure.write" if write else "infrastructure.read")
    permitted_roles = set(db.scalars(select(RolePermission.role_id).where(
        RolePermission.permission_id == permission)).all())
    for assignment in assignments_for(db, user):
        if assignment.role_id not in permitted_roles:
            continue
        if any(getattr(assignment, name) is not None and getattr(obj, name, None) != getattr(assignment, name)
               for name in ("region_id", "district_id", "organization_id")):
            continue
        if assignment.categories and getattr(obj, "category_id", None) not in assignment.categories:
            continue
        if SENSITIVITY.get(getattr(obj, "sensitivity", "internal"), 99) > SENSITIVITY.get(assignment.max_sensitivity, 1):
            continue
        if assignment.assigned_object_ids and getattr(obj, "id", None) not in assignment.assigned_object_ids:
            continue
        return True
    return False
