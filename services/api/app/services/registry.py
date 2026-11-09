from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from geoalchemy2.shape import from_shape
from sqlalchemy import select
from sqlalchemy.orm import Session
from shapely.geometry import shape

from app.core.policy import can_access, require_permission
from app.core.config import settings
from app.models import (
    AuditLog, InfrastructureCategory, InfrastructureObject, ObjectGeometry,
    ObjectRevision, PublicObject, Region,
)
from app.services.geometry import validate_geometry
from app.services.passports import validate_passport

STATES = {"working", "faulty", "under_maintenance", "temporarily_unavailable", "not_inspected", "unknown"}
SENSITIVITIES = {"public", "internal", "restricted", "confidential"}
OBJECT_FIELDS = (
    "id", "code", "name", "description", "category_id", "region_id", "district_id", "organization_id",
    "responsible_employee_id", "sensitivity", "operational_status", "lifecycle", "version", "geometry",
    "address",
    "passport", "accuracy_m", "survey_method", "survey_date", "data_source", "verification_status",
    "is_synthetic", "created_by", "updated_by", "created_at", "updated_at", "deleted_at", "published_revision_id",
)


def now() -> datetime:
    return datetime.now(UTC)


def as_json(value: Any):
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def object_dict(obj: InfrastructureObject) -> dict:
    return {field: as_json(getattr(obj, field, None)) for field in OBJECT_FIELDS}


def audit(db: Session, user, action: str, target_id: str | None, details: dict | None = None):
    # Details are deliberately allowlisted by callers; credentials and geometry never belong here.
    fields = {"actor_id": getattr(user, "id", None), "action": action, "target_id": target_id,
              "details": details or {}, "created_at": now()}
    columns = {column.name for column in AuditLog.__table__.columns}
    if "target_type" in columns:
        fields["target_type"] = action.split(".", 1)[0]
    db.add(AuditLog(**{k: v for k, v in fields.items() if k in columns}))


def authorized_object(db: Session, user, object_id: str, *, write: bool = False, include_deleted: bool = False, permission: str | None = None):
    obj = db.get(InfrastructureObject, object_id)
    if obj is None or (obj.deleted_at and not include_deleted) or not can_access(db, user, obj, write=write, permission=permission):
        raise HTTPException(404, "Obyekt topilmadi")
    # Ancillary endpoints must enforce the same pending/publication visibility as passports.
    visible_data(db, user, obj)
    return obj


def visible_data(db: Session, user, obj):
    if draft_author(db, obj) == user.id or can_access(db, user, obj, permission="infrastructure.review"):
        return object_dict(obj)
    published = db.get(ObjectRevision, obj.published_revision_id) if obj.published_revision_id else None
    if published is None:
        raise HTTPException(404, "Obyekt topilmadi")
    return published.data


def draft_author(db: Session, obj) -> str:
    author = db.scalar(select(ObjectRevision.created_by).where(ObjectRevision.object_id == obj.id,
                        ObjectRevision.state == "draft").order_by(ObjectRevision.version.desc()).limit(1))
    return author or obj.created_by


def draft_owner_clause(user_id: str):
    last_author = select(ObjectRevision.created_by).where(ObjectRevision.object_id == InfrastructureObject.id,
                   ObjectRevision.state == "draft").order_by(ObjectRevision.version.desc()).limit(1).correlate(InfrastructureObject).scalar_subquery()
    from sqlalchemy import func
    return func.coalesce(last_author, InfrastructureObject.created_by) == user_id


def check_version(obj, expected: int | None):
    if expected is None:
        raise HTTPException(428, {"code": "VERSION_REQUIRED", "message": "expected_version majburiy"})
    if expected != obj.version:
        raise HTTPException(409, {"code": "VERSION_CONFLICT", "message": "Obyekt boshqa foydalanuvchi tomonidan o‘zgartirilgan", "current": object_dict(obj)})


def validate_fields(db: Session, values: dict, current=None) -> dict:
    result = dict(values)
    category_id = result.get("category_id", getattr(current, "category_id", None))
    category = db.get(InfrastructureCategory, category_id)
    if category is None:
        raise HTTPException(422, "Kategoriya topilmadi")
    region_id = result.get("region_id", getattr(current, "region_id", None))
    region = db.get(Region, region_id)
    if region is None:
        raise HTTPException(422, "Hudud topilmadi")
    district_id = result.get("district_id", getattr(current, "district_id", None))
    if district_id:
        from app.models import District
        district = db.get(District, district_id)
        if district is None or district.region_id != region_id:
            raise HTTPException(422, "Tuman hududga mos emas")
    if "geometry" in result:
        allowed = getattr(category, "geometry_types", None)
        result["geometry"] = validate_geometry(result["geometry"], allowed if isinstance(allowed, list) else None)
    synthetic = result.get("is_synthetic", getattr(current, "is_synthetic", False))
    if not (synthetic and settings.is_development):
        if not settings.live_intake_enabled or not settings.live_policy_ready:
            raise HTTPException(503, "Haqiqiy ma’lumot qabul qilish operator tomonidan ochilmagan")
        if not region.geometry or region.source in {"synthetic_demo", "reference_only", "unknown"}:
            raise HTTPException(503, "Vakolatli hudud chegaralari yuklanmaguncha haqiqiy infratuzilma qabul qilinmaydi")
        geometry = result.get("geometry", getattr(current, "geometry", None))
        if not shape(region.geometry).covers(shape(geometry)):
            raise HTTPException(422, "Obyekt geometriyasi ruxsat etilgan hudud ichida to‘liq bo‘lishi kerak")
    if result.get("operational_status", "unknown") not in STATES:
        raise HTTPException(422, "Obyekt holati noto‘g‘ri")
    if result.get("sensitivity", "internal") not in SENSITIVITIES:
        raise HTTPException(422, "Ko‘rinish tasnifi noto‘g‘ri")
    if "passport" in result:
        schema = getattr(category, "schema_definition", None) or getattr(category, "passport_schema", None) or {}
        result["passport"] = validate_passport(category_id, result["passport"], schema)
    if "accuracy_m" in result and result["accuracy_m"] is not None:
        import math
        if not isinstance(result["accuracy_m"], (int, float)) or not math.isfinite(result["accuracy_m"]) or result["accuracy_m"] < 0:
            raise HTTPException(422, "GPS aniqligi manfiy yoki cheksiz bo‘lmaydi")
    if current and current.published_revision_id:
        for key in ("category_id", "region_id", "district_id", "organization_id", "sensitivity"):
            if key in result and result[key] != getattr(current, key):
                raise HTTPException(409, "Nashr qilingan obyekt tasnifi yoki hududini o‘zgartirish uchun uni arxivlash va qayta ko‘rib chiqish kerak")
    return result


def record_change(db: Session, obj, operation: str = "upsert"):
    from app.models import SyncChange, SyncCounter
    from sqlalchemy.dialects.postgresql import insert
    db.execute(insert(SyncCounter).values(id=1, value=0).on_conflict_do_nothing(index_elements=["id"]))
    counter = db.execute(select(SyncCounter).where(SyncCounter.id == 1).with_for_update()).scalar_one_or_none()
    # ponytail: one short transactional counter serializes event allocation; replace with commit-LSN CDC if measured throughput requires it.
    counter.value += 1
    db.add(SyncChange(cursor=counter.value, object_id=obj.id, kind=operation,
                      region_id=obj.region_id, version=obj.version))


def revision(db: Session, obj, user, *, changed: bool = True):
    if changed:
        obj.version += 1
    obj.updated_at = now()
    obj.updated_by = user.id
    row = ObjectRevision(id=str(uuid4()), object_id=obj.id, version=obj.version,
                         data=object_dict(obj), state=obj.lifecycle, created_by=user.id)
    db.add(row)
    db.flush()
    record_change(db, obj, "delete" if obj.deleted_at else "upsert")
    return row


def persist_specs(db: Session, obj):
    import app.models as models
    passport = db.execute(select(models.TechnicalPassport).where(models.TechnicalPassport.object_id == obj.id)).scalar_one_or_none()
    if passport is None:
        passport = models.TechnicalPassport(object_id=obj.id)
        db.add(passport)
        db.flush()
    from datetime import date
    for key in ("schema_version", "installation_date", "manufacturer", "material", "technical_condition", "last_inspection_date", "next_inspection_date", "notes"):
        value = obj.passport.get(key)
        if key.endswith("_date") and isinstance(value, str):
            value = date.fromisoformat(value)
        if key == "schema_version" and value is None:
            value = 1
        setattr(passport, key, value)
    category = obj.category_id.replace("-", "_")
    spec_class = (getattr(models, "HydrantSpec", None) if "hydrant" in category else
                  getattr(models, "SewerSpec", None) if "sewer" in category or "drain" in category else
                  getattr(models, "GasSpec", None) if "gas" in category else
                  getattr(models, "ElectricalSpec", None) if "electri" in category or "substation" in category else
                  getattr(models, "WaterPipelineSpec", None) if "water" in category or "pump" in category else None)
    if spec_class is None:
        return
    row = db.get(spec_class, passport.id)
    if row is None:
        row = spec_class(passport_id=passport.id)
        db.add(row)
    for column in spec_class.__table__.columns:
        key = column.name
        source_key = {"pipeline_identifier": "connected_pipeline_id", "installation_depth_m": "depth_m",
                      "nominal_pressure_kpa": "pressure_kpa" if "gas" in category else "nominal_pressure_kpa"}.get(key, key)
        if source_key in obj.passport and key not in {"id", "passport_id"}:
            value = obj.passport[source_key]
            try:
                python_type = column.type.python_type
            except NotImplementedError:
                python_type = None
            if value is not None and isinstance(value, str):
                if python_type is datetime:
                    value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                elif python_type is date:
                    value = date.fromisoformat(value)
            setattr(row, key, value)
    for key, value in obj.passport.get("extensions", {}).items():
        field = db.execute(select(models.TechnicalFieldValue).where(models.TechnicalFieldValue.passport_id == passport.id,
                           models.TechnicalFieldValue.field_key == key)).scalar_one_or_none()
        if field is None:
            field = models.TechnicalFieldValue(passport_id=passport.id, field_key=key)
            db.add(field)
        field.value_text = field.value_number = field.value_boolean = field.value_date = None
        if isinstance(value, bool):
            field.value_boolean = value
        elif isinstance(value, (int, float)):
            field.value_number = value
        elif isinstance(value, str):
            field.value_text = value


def write_geometry(db: Session, obj):
    geo = db.execute(select(ObjectGeometry).where(ObjectGeometry.object_id == obj.id)).scalar_one_or_none()
    if geo is None:
        geo = ObjectGeometry(object_id=obj.id)
        db.add(geo)
    geo.geom = from_shape(shape(obj.geometry), srid=4326)


def create_object(db: Session, user, values: dict):
    require_permission(user, "infrastructure.write", db)
    values = validate_fields(db, values)
    obj = InfrastructureObject(id=str(uuid4()), **values, created_by=user.id, updated_by=user.id,
                               lifecycle="draft", version=1)
    if not can_access(db, user, obj, write=True):
        raise HTTPException(403, "Ushbu hudud yoki kategoriya uchun yozish ruxsati yo‘q")
    db.add(obj)
    db.flush()
    write_geometry(db, obj)
    persist_specs(db, obj)
    revision(db, obj, user, changed=False)
    audit(db, user, "infrastructure.create", obj.id)
    return obj


def update_object(db: Session, user, object_id: str, values: dict, expected: int | None):
    require_permission(user, "infrastructure.write", db)
    obj = db.execute(select(InfrastructureObject).where(InfrastructureObject.id == object_id).with_for_update()).scalar_one_or_none()
    if obj is None or obj.deleted_at or not can_access(db, user, obj, write=True):
        raise HTTPException(404, "Obyekt topilmadi")
    if obj.lifecycle != "published" and draft_author(db, obj) != user.id and not can_access(db, user, obj, permission="infrastructure.review"):
        raise HTTPException(404, "Obyekt topilmadi")
    check_version(obj, expected)
    if obj.lifecycle in {"submitted", "under_review", "approved"}:
        raise HTTPException(409, "Ko‘rib chiqilayotgan tahrirni o‘zgartirib bo‘lmaydi")
    values = validate_fields(db, values, current=obj)
    for key, value in values.items():
        setattr(obj, key, value)
    obj.lifecycle = "draft"
    write_geometry(db, obj)
    persist_specs(db, obj)
    revision(db, obj, user)
    audit(db, user, "infrastructure.update", obj.id, {"version": obj.version})
    return obj


def publish_public(db: Session, obj, user):
    if obj.sensitivity != "public" or obj.lifecycle != "published":
        raise HTTPException(409, "Faqat ommaviy tasnifdagi nashr qilingan obyektni alohida tekshiruvdan keyin ochish mumkin")
    row = db.execute(select(PublicObject).where(PublicObject.object_id == obj.id)).scalar_one_or_none()
    if row is None:
        row = PublicObject(id=str(uuid4()), object_id=obj.id, published_by=user.id)
        db.add(row)
    for key in ("name", "category_id", "region_id", "district_id", "geometry", "operational_status", "is_synthetic"):
        setattr(row, key, getattr(obj, key))
    row.updated_at = now()
    row.published_by = user.id
    return row
