"""Normalized persistence models shared by the HTTP service and worker."""
from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id, utcnow

JSONType = JSON().with_variant(JSONB, "postgresql")


class IdentityMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Region(Base):
    __tablename__ = "regions"
    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    name_uz: Mapped[str] = mapped_column(String(100))
    name_ru: Mapped[str] = mapped_column(String(100), default="")
    name_en: Mapped[str] = mapped_column(String(100), default="")
    geometry: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    source: Mapped[str] = mapped_column(String(255), default="ISO 3166-2; boundaries not supplied")


class District(Base):
    __tablename__ = "districts"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"), index=True)
    name_uz: Mapped[str] = mapped_column(String(150))
    name_ru: Mapped[str] = mapped_column(String(150), default="")
    name_en: Mapped[str] = mapped_column(String(150), default="")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)


class Organization(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "organizations"
    name: Mapped[str] = mapped_column(String(200))
    region_id: Mapped[str | None] = mapped_column(ForeignKey("regions.id"), nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)


class User(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "users"
    phone: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200), default="")
    role: Mapped[str] = mapped_column(String(40), default="citizen", index=True)
    employee_status: Mapped[str] = mapped_column(String(40), default="none")
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    region_id: Mapped[str | None] = mapped_column(ForeignKey("regions.id"), nullable=True)
    district_id: Mapped[str | None] = mapped_column(ForeignKey("districts.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    policy_epoch: Mapped[int] = mapped_column(Integer, default=1)
    mfa_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    language: Mapped[str] = mapped_column(String(5), default="uz")
    notification_preferences: Mapped[dict] = mapped_column(JSONType, default=dict)
    department: Mapped[str | None] = mapped_column(String(200), nullable=True)


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))


class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    description: Mapped[str] = mapped_column(String(200), default="")


class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    permission_id: Mapped[str] = mapped_column(ForeignKey("permissions.id"), primary_key=True)


class RoleAssignment(IdentityMixin, Base):
    __tablename__ = "role_assignments"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"))
    region_id: Mapped[str | None] = mapped_column(ForeignKey("regions.id"), nullable=True)
    district_id: Mapped[str | None] = mapped_column(ForeignKey("districts.id"), nullable=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    categories: Mapped[list] = mapped_column(JSONType, default=list)
    max_sensitivity: Mapped[str] = mapped_column(String(20), default="internal")
    assigned_object_ids: Mapped[list] = mapped_column(JSONType, default=list)
    granted_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EmployeeVerification(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "employee_verifications"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    organization_name: Mapped[str] = mapped_column(String(200), default="")
    department: Mapped[str] = mapped_column(String(200), default="")
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"))
    district_id: Mapped[str | None] = mapped_column(ForeignKey("districts.id"), nullable=True)
    verification_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    requested_role: Mapped[str] = mapped_column(String(40), default="verified_employee")
    status: Mapped[str] = mapped_column(String(40), default="pending_verification", index=True)
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class OTPChallenge(IdentityMixin, Base):
    __tablename__ = "otp_challenges"
    phone: Mapped[str] = mapped_column(String(20), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    code_hash: Mapped[str] = mapped_column(String(64))
    registration_data: Mapped[dict] = mapped_column(JSONType, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuthSession(IdentityMixin, Base):
    __tablename__ = "auth_sessions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    device_id: Mapped[str] = mapped_column(String(200), default="unknown")
    mfa_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RefreshToken(IdentityMixin, Base):
    __tablename__ = "refresh_tokens"
    session_id: Mapped[str] = mapped_column(ForeignKey("auth_sessions.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class InfrastructureCategory(Base):
    __tablename__ = "infrastructure_categories"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name_uz: Mapped[str] = mapped_column(String(120))
    name_ru: Mapped[str] = mapped_column(String(120), default="")
    name_en: Mapped[str] = mapped_column(String(120), default="")
    geometry_types: Mapped[list] = mapped_column(JSONType, default=lambda: ["Point"])
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    passport_schema: Mapped[dict] = mapped_column(JSONType, default=dict)
    icon: Mapped[str] = mapped_column(String(50), default="location_on")
    color: Mapped[str] = mapped_column(String(12), default="#20D3E8")


class CategorySchemaVersion(IdentityMixin, Base):
    __tablename__ = "category_schema_versions"
    __table_args__ = (UniqueConstraint("category_id", "version"),)
    category_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_categories.id"))
    version: Mapped[int] = mapped_column(Integer)
    definition: Mapped[dict] = mapped_column(JSONType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class InfrastructureObject(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "infrastructure_objects"
    __table_args__ = (CheckConstraint("version > 0"), CheckConstraint("accuracy_m IS NULL OR accuracy_m >= 0"),)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_categories.id"), index=True)
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"), index=True)
    district_id: Mapped[str | None] = mapped_column(ForeignKey("districts.id"), nullable=True, index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    responsible_employee_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    address: Mapped[str | None] = mapped_column(String(400), nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(20), default="internal", index=True)
    operational_status: Mapped[str] = mapped_column(String(40), default="unknown", index=True)
    lifecycle: Mapped[str] = mapped_column(String(40), default="draft", index=True)
    verification_status: Mapped[str] = mapped_column(String(40), default="unverified")
    version: Mapped[int] = mapped_column(Integer, default=1)
    geometry: Mapped[dict] = mapped_column(JSONType)
    passport: Mapped[dict] = mapped_column(JSONType, default=dict)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    survey_method: Mapped[str | None] = mapped_column(String(120), nullable=True)
    survey_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_source: Mapped[str] = mapped_column(String(255), default="user_submission")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    updated_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    published_revision_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class ObjectGeometry(IdentityMixin, Base):
    __tablename__ = "object_geometries"
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), unique=True)
    geom: Mapped[object] = mapped_column(Geometry(geometry_type="GEOMETRY", srid=4326, spatial_index=True))
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    survey_method: Mapped[str | None] = mapped_column(String(120), nullable=True)


class TechnicalPassport(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "technical_passports"
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), unique=True)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    installation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    material: Mapped[str | None] = mapped_column(String(100), nullable=True)
    technical_condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_inspection_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_inspection_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class HydrantSpec(Base):
    __tablename__ = "hydrant_specs"
    __table_args__ = (CheckConstraint("connection_diameter_mm IS NULL OR connection_diameter_mm > 0"), CheckConstraint("measured_pressure_kpa IS NULL OR measured_pressure_kpa >= 0"), CheckConstraint("flow_lps IS NULL OR flow_lps >= 0"),)
    passport_id: Mapped[str] = mapped_column(ForeignKey("technical_passports.id"), primary_key=True)
    hydrant_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    installation_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    installation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pipeline_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    connection_diameter_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    nominal_pressure_kpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    measured_pressure_kpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    flow_lps: Mapped[float | None] = mapped_column(Float, nullable=True)
    measurement_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    measurement_method: Mapped[str | None] = mapped_column(String(120), nullable=True)
    accessibility_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    visible_condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_maintenance_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    defect_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    repair_status: Mapped[str | None] = mapped_column(String(80), nullable=True)


class HydrantMeasurement(IdentityMixin, Base):
    __tablename__ = "hydrant_measurements"
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), index=True)
    pressure_kpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    flow_lps: Mapped[float | None] = mapped_column(Float, nullable=True)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    method: Mapped[str] = mapped_column(String(120))
    measured_by: Mapped[str] = mapped_column(ForeignKey("users.id"))


class WaterPipelineSpec(Base):
    __tablename__ = "water_pipeline_specs"
    passport_id: Mapped[str] = mapped_column(ForeignKey("technical_passports.id"), primary_key=True)
    diameter_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    material: Mapped[str | None] = mapped_column(String(100), nullable=True)
    length_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    installation_depth_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    pressure_kpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    commissioning_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class SewerSpec(Base):
    __tablename__ = "sewer_specs"
    passport_id: Mapped[str] = mapped_column(ForeignKey("technical_passports.id"), primary_key=True)
    diameter_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    material: Mapped[str | None] = mapped_column(String(100), nullable=True)
    depth_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    flow_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    maintenance_condition: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reported_blockages: Mapped[int | None] = mapped_column(Integer, nullable=True)


class GasSpec(Base):
    __tablename__ = "gas_specs"
    passport_id: Mapped[str] = mapped_column(ForeignKey("technical_passports.id"), primary_key=True)
    material: Mapped[str | None] = mapped_column(String(100), nullable=True)
    classification: Mapped[str | None] = mapped_column(String(100), nullable=True)
    diameter_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    nominal_pressure_kpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    inspection_status: Mapped[str | None] = mapped_column(String(100), nullable=True)


class ElectricalSpec(Base):
    __tablename__ = "electrical_specs"
    passport_id: Mapped[str] = mapped_column(ForeignKey("technical_passports.id"), primary_key=True)
    voltage_kv: Mapped[float | None] = mapped_column(Float, nullable=True)
    voltage_classification: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cable_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    installation_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    maintenance_status: Mapped[str | None] = mapped_column(String(100), nullable=True)


class TechnicalFieldValue(IdentityMixin, Base):
    __tablename__ = "technical_field_values"
    __table_args__ = (UniqueConstraint("passport_id", "field_key"),)
    passport_id: Mapped[str] = mapped_column(ForeignKey("technical_passports.id"), index=True)
    field_key: Mapped[str] = mapped_column(String(100))
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_number: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_boolean: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    value_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)


class PipelineConnection(IdentityMixin, Base):
    __tablename__ = "pipeline_connections"
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), index=True)
    connected_object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"))
    connection_type: Mapped[str] = mapped_column(String(40), default="endpoint")


class ObjectAttachment(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "object_attachments"
    __table_args__ = (CheckConstraint("(object_id IS NOT NULL AND report_id IS NULL) OR (object_id IS NULL AND report_id IS NOT NULL)", name="attachment_single_parent"),)
    object_id: Mapped[str | None] = mapped_column(ForeignKey("infrastructure_objects.id"), nullable=True, index=True)
    report_id: Mapped[str | None] = mapped_column(ForeignKey("citizen_reports.id"), nullable=True, index=True)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    sha256: Mapped[str] = mapped_column(String(64))
    scan_status: Mapped[str] = mapped_column(String(30), default="quarantined")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Inspection(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "inspections"
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), index=True)
    inspector_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    inspected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    condition: Mapped[str] = mapped_column(String(80))
    operational_status: Mapped[str] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_inspection_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    measurements: Mapped[dict] = mapped_column(JSONType, default=dict)


class MaintenanceRecord(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "maintenance_records"
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), index=True)
    performed_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="completed")


class ObjectRevision(IdentityMixin, Base):
    __tablename__ = "object_revisions"
    __table_args__ = (UniqueConstraint("object_id", "version"),)
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSONType)
    state: Mapped[str] = mapped_column(String(40))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApprovalRequest(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "approval_requests"
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), index=True)
    revision_id: Mapped[str] = mapped_column(ForeignKey("object_revisions.id"))
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="submitted", index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditLog(IdentityMixin, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    target_type: Mapped[str] = mapped_column(String(100), default="system")
    target_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    outcome: Mapped[str] = mapped_column(String(30), default="success")
    details: Mapped[dict] = mapped_column(JSONType, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class PublicObject(IdentityMixin, Base):
    __tablename__ = "public_objects"
    object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"), unique=True)
    name: Mapped[str] = mapped_column(String(250))
    category_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_categories.id"))
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"))
    district_id: Mapped[str | None] = mapped_column(ForeignKey("districts.id"), nullable=True)
    geometry: Mapped[dict] = mapped_column(JSONType)
    operational_status: Mapped[str] = mapped_column(String(40), default="unknown")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    published_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CitizenReport(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "citizen_reports"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    geometry: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    contact_information: Mapped[str | None] = mapped_column(String(255), nullable=True)
    region_id: Mapped[str | None] = mapped_column(ForeignKey("regions.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="received", index=True)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    legal_hold: Mapped[bool] = mapped_column(Boolean, default=False)


class Notification(IdentityMixin, Base):
    __tablename__ = "notifications"
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(50), default="information")
    target_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DeviceRegistration(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "device_registrations"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    device_id: Mapped[str] = mapped_column(String(200))
    push_token: Mapped[str] = mapped_column(Text)
    platform: Mapped[str] = mapped_column(String(20), default="android")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SyncOperation(IdentityMixin, Base):
    __tablename__ = "offline_sync_operations"
    __table_args__ = (UniqueConstraint("user_id", "operation_id"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    operation_id: Mapped[str] = mapped_column(String(100))
    device_id: Mapped[str] = mapped_column(String(200), default="unknown")
    payload_hash: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict] = mapped_column(JSONType, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SyncCounter(Base):
    __tablename__ = "sync_counter"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    value: Mapped[int] = mapped_column(Integer, default=0)


class SyncChange(Base):
    __tablename__ = "sync_changes"
    cursor: Mapped[int] = mapped_column(Integer, primary_key=True)
    object_id: Mapped[str] = mapped_column(String(36), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    region_id: Mapped[str | None] = mapped_column(String(12), nullable=True)
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApprovedRoute(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "approved_routes"
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    destination_object_id: Mapped[str] = mapped_column(ForeignKey("infrastructure_objects.id"))
    geometry: Mapped[dict] = mapped_column(JSONType)
    steps: Mapped[list] = mapped_column(JSONType, default=list)
    distance_m: Mapped[float] = mapped_column(Float)
    duration_s: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_date: Mapped[str] = mapped_column(String(50), default="unknown")
    version: Mapped[int] = mapped_column(Integer, default=1)


class RetentionDeletion(IdentityMixin, Base):
    __tablename__ = "retention_deletions"
    report_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    storage_keys: Mapped[list] = mapped_column(JSONType, default=list)
    policy_reference: Mapped[str] = mapped_column(String(255))
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    blobs_deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ledger_exported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
