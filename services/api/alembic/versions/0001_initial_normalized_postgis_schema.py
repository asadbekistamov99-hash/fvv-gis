"""initial normalized PostGIS schema

Revision ID: 0001
Revises: 
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    # Schema definitions are frozen in this migration.
    op.create_table('infrastructure_categories',
    sa.Column('id', sa.String(length=60), nullable=False),
    sa.Column('name_uz', sa.String(length=120), nullable=False),
    sa.Column('name_ru', sa.String(length=120), nullable=False),
    sa.Column('name_en', sa.String(length=120), nullable=False),
    sa.Column('geometry_types', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('schema_version', sa.Integer(), nullable=False),
    sa.Column('passport_schema', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('icon', sa.String(length=50), nullable=False),
    sa.Column('color', sa.String(length=12), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('otp_challenges',
    sa.Column('phone', sa.String(length=20), nullable=False),
    sa.Column('purpose', sa.String(length=20), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('registration_data', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_otp_challenges_phone'), 'otp_challenges', ['phone'], unique=False)
    op.create_table('permissions',
    sa.Column('id', sa.String(length=80), nullable=False),
    sa.Column('description', sa.String(length=200), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('regions',
    sa.Column('id', sa.String(length=12), nullable=False),
    sa.Column('name_uz', sa.String(length=100), nullable=False),
    sa.Column('name_ru', sa.String(length=100), nullable=False),
    sa.Column('name_en', sa.String(length=100), nullable=False),
    sa.Column('geometry', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('source', sa.String(length=255), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('retention_deletions',
    sa.Column('report_id', sa.String(length=36), nullable=True),
    sa.Column('storage_keys', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('policy_reference', sa.String(length=255), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('blobs_deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ledger_exported_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_retention_deletions_report_id'), 'retention_deletions', ['report_id'], unique=False)
    op.create_table('roles',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sync_changes',
    sa.Column('cursor', sa.Integer(), nullable=False),
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('kind', sa.String(length=40), nullable=False),
    sa.Column('region_id', sa.String(length=12), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('cursor')
    )
    op.create_index(op.f('ix_sync_changes_object_id'), 'sync_changes', ['object_id'], unique=False)
    op.create_table('sync_counter',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('value', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('category_schema_versions',
    sa.Column('category_id', sa.String(length=60), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('definition', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['infrastructure_categories.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('category_id', 'version')
    )
    op.create_table('districts',
    sa.Column('id', sa.String(length=50), nullable=False),
    sa.Column('region_id', sa.String(length=12), nullable=False),
    sa.Column('name_uz', sa.String(length=150), nullable=False),
    sa.Column('name_ru', sa.String(length=150), nullable=False),
    sa.Column('name_en', sa.String(length=150), nullable=False),
    sa.Column('is_synthetic', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_districts_region_id'), 'districts', ['region_id'], unique=False)
    op.create_table('organizations',
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('region_id', sa.String(length=12), nullable=True),
    sa.Column('is_synthetic', sa.Boolean(), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('role_permissions',
    sa.Column('role_id', sa.String(length=40), nullable=False),
    sa.Column('permission_id', sa.String(length=80), nullable=False),
    sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
    sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )
    op.create_table('users',
    sa.Column('phone', sa.String(length=80), nullable=False),
    sa.Column('full_name', sa.String(length=200), nullable=False),
    sa.Column('role', sa.String(length=40), nullable=False),
    sa.Column('employee_status', sa.String(length=40), nullable=False),
    sa.Column('organization_id', sa.String(length=36), nullable=True),
    sa.Column('region_id', sa.String(length=12), nullable=True),
    sa.Column('district_id', sa.String(length=50), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_synthetic', sa.Boolean(), nullable=False),
    sa.Column('phone_verified_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('policy_epoch', sa.Integer(), nullable=False),
    sa.Column('mfa_secret', sa.Text(), nullable=True),
    sa.Column('mfa_enabled', sa.Boolean(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_phone'), 'users', ['phone'], unique=True)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_table('audit_logs',
    sa.Column('actor_id', sa.String(length=36), nullable=True),
    sa.Column('action', sa.String(length=100), nullable=False),
    sa.Column('target_type', sa.String(length=100), nullable=False),
    sa.Column('target_id', sa.String(length=100), nullable=True),
    sa.Column('outcome', sa.String(length=30), nullable=False),
    sa.Column('details', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('request_id', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_actor_id'), 'audit_logs', ['actor_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_table('auth_sessions',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('device_id', sa.String(length=200), nullable=False),
    sa.Column('mfa_verified', sa.Boolean(), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_auth_sessions_user_id'), 'auth_sessions', ['user_id'], unique=False)
    op.create_table('citizen_reports',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('category', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('geometry', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('contact_information', sa.String(length=255), nullable=True),
    sa.Column('region_id', sa.String(length=12), nullable=True),
    sa.Column('status', sa.String(length=40), nullable=False),
    sa.Column('assigned_to', sa.String(length=36), nullable=True),
    sa.Column('is_synthetic', sa.Boolean(), nullable=False),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('legal_hold', sa.Boolean(), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_citizen_reports_region_id'), 'citizen_reports', ['region_id'], unique=False)
    op.create_index(op.f('ix_citizen_reports_status'), 'citizen_reports', ['status'], unique=False)
    op.create_index(op.f('ix_citizen_reports_user_id'), 'citizen_reports', ['user_id'], unique=False)
    op.create_table('device_registrations',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('device_id', sa.String(length=200), nullable=False),
    sa.Column('push_token', sa.Text(), nullable=False),
    sa.Column('platform', sa.String(length=20), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_device_registrations_user_id'), 'device_registrations', ['user_id'], unique=False)
    op.create_table('employee_verifications',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('full_name', sa.String(length=200), nullable=False),
    sa.Column('organization_id', sa.String(length=36), nullable=True),
    sa.Column('organization_name', sa.String(length=200), nullable=False),
    sa.Column('department', sa.String(length=200), nullable=False),
    sa.Column('region_id', sa.String(length=12), nullable=False),
    sa.Column('district_id', sa.String(length=50), nullable=True),
    sa.Column('verification_reference', sa.String(length=200), nullable=True),
    sa.Column('requested_role', sa.String(length=40), nullable=False),
    sa.Column('status', sa.String(length=40), nullable=False),
    sa.Column('reviewed_by', sa.String(length=36), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('review_note', sa.Text(), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
    sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_employee_verifications_status'), 'employee_verifications', ['status'], unique=False)
    op.create_index(op.f('ix_employee_verifications_user_id'), 'employee_verifications', ['user_id'], unique=False)
    op.create_table('infrastructure_objects',
    sa.Column('code', sa.String(length=80), nullable=False),
    sa.Column('name', sa.String(length=250), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('category_id', sa.String(length=60), nullable=False),
    sa.Column('region_id', sa.String(length=12), nullable=False),
    sa.Column('district_id', sa.String(length=50), nullable=True),
    sa.Column('organization_id', sa.String(length=36), nullable=False),
    sa.Column('responsible_employee_id', sa.String(length=36), nullable=True),
    sa.Column('address', sa.String(length=400), nullable=True),
    sa.Column('sensitivity', sa.String(length=20), nullable=False),
    sa.Column('operational_status', sa.String(length=40), nullable=False),
    sa.Column('lifecycle', sa.String(length=40), nullable=False),
    sa.Column('verification_status', sa.String(length=40), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('geometry', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('passport', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('accuracy_m', sa.Float(), nullable=True),
    sa.Column('survey_method', sa.String(length=120), nullable=True),
    sa.Column('survey_date', sa.Date(), nullable=True),
    sa.Column('data_source', sa.String(length=255), nullable=False),
    sa.Column('is_synthetic', sa.Boolean(), nullable=False),
    sa.Column('created_by', sa.String(length=36), nullable=False),
    sa.Column('updated_by', sa.String(length=36), nullable=False),
    sa.Column('published_revision_id', sa.String(length=36), nullable=True),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('accuracy_m IS NULL OR accuracy_m >= 0'),
    sa.CheckConstraint('version > 0'),
    sa.ForeignKeyConstraint(['category_id'], ['infrastructure_categories.id'], ),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
    sa.ForeignKeyConstraint(['responsible_employee_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_infrastructure_objects_category_id'), 'infrastructure_objects', ['category_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_objects_code'), 'infrastructure_objects', ['code'], unique=True)
    op.create_index(op.f('ix_infrastructure_objects_created_by'), 'infrastructure_objects', ['created_by'], unique=False)
    op.create_index(op.f('ix_infrastructure_objects_deleted_at'), 'infrastructure_objects', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_infrastructure_objects_district_id'), 'infrastructure_objects', ['district_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_objects_lifecycle'), 'infrastructure_objects', ['lifecycle'], unique=False)
    op.create_index(op.f('ix_infrastructure_objects_operational_status'), 'infrastructure_objects', ['operational_status'], unique=False)
    op.create_index(op.f('ix_infrastructure_objects_organization_id'), 'infrastructure_objects', ['organization_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_objects_region_id'), 'infrastructure_objects', ['region_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_objects_sensitivity'), 'infrastructure_objects', ['sensitivity'], unique=False)
    op.create_table('notifications',
    sa.Column('user_id', sa.String(length=36), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('kind', sa.String(length=50), nullable=False),
    sa.Column('target_id', sa.String(length=100), nullable=True),
    sa.Column('is_public', sa.Boolean(), nullable=False),
    sa.Column('reviewed_by', sa.String(length=36), nullable=True),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_table('offline_sync_operations',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('operation_id', sa.String(length=100), nullable=False),
    sa.Column('device_id', sa.String(length=200), nullable=False),
    sa.Column('payload_hash', sa.String(length=64), nullable=False),
    sa.Column('result', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'operation_id')
    )
    op.create_index(op.f('ix_offline_sync_operations_user_id'), 'offline_sync_operations', ['user_id'], unique=False)
    op.create_table('role_assignments',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('role_id', sa.String(length=40), nullable=False),
    sa.Column('region_id', sa.String(length=12), nullable=True),
    sa.Column('district_id', sa.String(length=50), nullable=True),
    sa.Column('organization_id', sa.String(length=36), nullable=True),
    sa.Column('categories', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('max_sensitivity', sa.String(length=20), nullable=False),
    sa.Column('assigned_object_ids', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('granted_by', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ),
    sa.ForeignKeyConstraint(['granted_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_role_assignments_user_id'), 'role_assignments', ['user_id'], unique=False)
    op.create_table('user_profiles',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('language', sa.String(length=5), nullable=False),
    sa.Column('notification_preferences', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('department', sa.String(length=200), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('approved_routes',
    sa.Column('requested_by', sa.String(length=36), nullable=False),
    sa.Column('destination_object_id', sa.String(length=36), nullable=False),
    sa.Column('geometry', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('steps', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('distance_m', sa.Float(), nullable=False),
    sa.Column('duration_s', sa.Float(), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('approved_by', sa.String(length=36), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('source_date', sa.String(length=50), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['destination_object_id'], ['infrastructure_objects.id'], ),
    sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('hydrant_measurements',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('pressure_kpa', sa.Float(), nullable=True),
    sa.Column('flow_lps', sa.Float(), nullable=True),
    sa.Column('measured_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('method', sa.String(length=120), nullable=False),
    sa.Column('measured_by', sa.String(length=36), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['measured_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_hydrant_measurements_object_id'), 'hydrant_measurements', ['object_id'], unique=False)
    op.create_table('inspections',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('inspector_id', sa.String(length=36), nullable=False),
    sa.Column('inspected_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('condition', sa.String(length=80), nullable=False),
    sa.Column('operational_status', sa.String(length=40), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('next_inspection_date', sa.Date(), nullable=True),
    sa.Column('measurements', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['inspector_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_inspections_object_id'), 'inspections', ['object_id'], unique=False)
    op.create_table('maintenance_records',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('performed_by', sa.String(length=36), nullable=False),
    sa.Column('performed_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=50), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.ForeignKeyConstraint(['performed_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maintenance_records_object_id'), 'maintenance_records', ['object_id'], unique=False)
    op.create_table('object_attachments',
    sa.Column('object_id', sa.String(length=36), nullable=True),
    sa.Column('report_id', sa.String(length=36), nullable=True),
    sa.Column('uploaded_by', sa.String(length=36), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('content_type', sa.String(length=100), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('storage_key', sa.String(length=500), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('scan_status', sa.String(length=30), nullable=False),
    sa.Column('is_public', sa.Boolean(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('(object_id IS NOT NULL AND report_id IS NULL) OR (object_id IS NULL AND report_id IS NOT NULL)', name='attachment_single_parent'),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['citizen_reports.id'], ),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('storage_key')
    )
    op.create_index(op.f('ix_object_attachments_object_id'), 'object_attachments', ['object_id'], unique=False)
    op.create_index(op.f('ix_object_attachments_report_id'), 'object_attachments', ['report_id'], unique=False)
    op.create_table('object_geometries',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('geom', geoalchemy2.types.Geometry(srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry', nullable=False, spatial_index=False), nullable=False),
    sa.Column('accuracy_m', sa.Float(), nullable=True),
    sa.Column('survey_method', sa.String(length=120), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('object_id')
    )
    op.create_index('idx_object_geometries_geom', 'object_geometries', ['geom'], unique=False, postgresql_using='gist')
    op.create_table('object_revisions',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('data', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('state', sa.String(length=40), nullable=False),
    sa.Column('created_by', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('object_id', 'version')
    )
    op.create_index(op.f('ix_object_revisions_object_id'), 'object_revisions', ['object_id'], unique=False)
    op.create_table('pipeline_connections',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('connected_object_id', sa.String(length=36), nullable=False),
    sa.Column('connection_type', sa.String(length=40), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['connected_object_id'], ['infrastructure_objects.id'], ),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pipeline_connections_object_id'), 'pipeline_connections', ['object_id'], unique=False)
    op.create_table('public_objects',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=250), nullable=False),
    sa.Column('category_id', sa.String(length=60), nullable=False),
    sa.Column('region_id', sa.String(length=12), nullable=False),
    sa.Column('district_id', sa.String(length=50), nullable=True),
    sa.Column('geometry', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('operational_status', sa.String(length=40), nullable=False),
    sa.Column('is_synthetic', sa.Boolean(), nullable=False),
    sa.Column('published_by', sa.String(length=36), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['infrastructure_categories.id'], ),
    sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.ForeignKeyConstraint(['published_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('object_id')
    )
    op.create_table('refresh_tokens',
    sa.Column('session_id', sa.String(length=36), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['auth_sessions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_refresh_tokens_session_id'), 'refresh_tokens', ['session_id'], unique=False)
    op.create_table('technical_passports',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('schema_version', sa.Integer(), nullable=False),
    sa.Column('installation_date', sa.Date(), nullable=True),
    sa.Column('manufacturer', sa.String(length=200), nullable=True),
    sa.Column('material', sa.String(length=100), nullable=True),
    sa.Column('technical_condition', sa.String(length=100), nullable=True),
    sa.Column('last_inspection_date', sa.Date(), nullable=True),
    sa.Column('next_inspection_date', sa.Date(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('object_id')
    )
    op.create_table('approval_requests',
    sa.Column('object_id', sa.String(length=36), nullable=False),
    sa.Column('revision_id', sa.String(length=36), nullable=False),
    sa.Column('requested_by', sa.String(length=36), nullable=False),
    sa.Column('reviewed_by', sa.String(length=36), nullable=True),
    sa.Column('status', sa.String(length=40), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['object_id'], ['infrastructure_objects.id'], ),
    sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['revision_id'], ['object_revisions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_approval_requests_object_id'), 'approval_requests', ['object_id'], unique=False)
    op.create_index(op.f('ix_approval_requests_status'), 'approval_requests', ['status'], unique=False)
    op.create_table('electrical_specs',
    sa.Column('passport_id', sa.String(length=36), nullable=False),
    sa.Column('voltage_kv', sa.Float(), nullable=True),
    sa.Column('voltage_classification', sa.String(length=100), nullable=True),
    sa.Column('cable_type', sa.String(length=100), nullable=True),
    sa.Column('installation_method', sa.String(length=100), nullable=True),
    sa.Column('maintenance_status', sa.String(length=100), nullable=True),
    sa.ForeignKeyConstraint(['passport_id'], ['technical_passports.id'], ),
    sa.PrimaryKeyConstraint('passport_id')
    )
    op.create_table('gas_specs',
    sa.Column('passport_id', sa.String(length=36), nullable=False),
    sa.Column('material', sa.String(length=100), nullable=True),
    sa.Column('classification', sa.String(length=100), nullable=True),
    sa.Column('diameter_mm', sa.Float(), nullable=True),
    sa.Column('nominal_pressure_kpa', sa.Float(), nullable=True),
    sa.Column('inspection_status', sa.String(length=100), nullable=True),
    sa.ForeignKeyConstraint(['passport_id'], ['technical_passports.id'], ),
    sa.PrimaryKeyConstraint('passport_id')
    )
    op.create_table('hydrant_specs',
    sa.Column('passport_id', sa.String(length=36), nullable=False),
    sa.Column('hydrant_type', sa.String(length=80), nullable=True),
    sa.Column('installation_type', sa.String(length=30), nullable=True),
    sa.Column('model', sa.String(length=120), nullable=True),
    sa.Column('installation_year', sa.Integer(), nullable=True),
    sa.Column('pipeline_identifier', sa.String(length=100), nullable=True),
    sa.Column('connection_diameter_mm', sa.Float(), nullable=True),
    sa.Column('nominal_pressure_kpa', sa.Float(), nullable=True),
    sa.Column('measured_pressure_kpa', sa.Float(), nullable=True),
    sa.Column('flow_lps', sa.Float(), nullable=True),
    sa.Column('measurement_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('measurement_method', sa.String(length=120), nullable=True),
    sa.Column('accessibility_status', sa.String(length=100), nullable=True),
    sa.Column('visible_condition', sa.String(length=100), nullable=True),
    sa.Column('last_maintenance_date', sa.Date(), nullable=True),
    sa.Column('defect_description', sa.Text(), nullable=True),
    sa.Column('repair_status', sa.String(length=80), nullable=True),
    sa.CheckConstraint('connection_diameter_mm IS NULL OR connection_diameter_mm > 0'),
    sa.CheckConstraint('flow_lps IS NULL OR flow_lps >= 0'),
    sa.CheckConstraint('measured_pressure_kpa IS NULL OR measured_pressure_kpa >= 0'),
    sa.ForeignKeyConstraint(['passport_id'], ['technical_passports.id'], ),
    sa.PrimaryKeyConstraint('passport_id')
    )
    op.create_table('sewer_specs',
    sa.Column('passport_id', sa.String(length=36), nullable=False),
    sa.Column('diameter_mm', sa.Float(), nullable=True),
    sa.Column('material', sa.String(length=100), nullable=True),
    sa.Column('depth_m', sa.Float(), nullable=True),
    sa.Column('flow_type', sa.String(length=80), nullable=True),
    sa.Column('maintenance_condition', sa.String(length=120), nullable=True),
    sa.Column('reported_blockages', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['passport_id'], ['technical_passports.id'], ),
    sa.PrimaryKeyConstraint('passport_id')
    )
    op.create_table('technical_field_values',
    sa.Column('passport_id', sa.String(length=36), nullable=False),
    sa.Column('field_key', sa.String(length=100), nullable=False),
    sa.Column('value_text', sa.Text(), nullable=True),
    sa.Column('value_number', sa.Float(), nullable=True),
    sa.Column('value_boolean', sa.Boolean(), nullable=True),
    sa.Column('value_date', sa.Date(), nullable=True),
    sa.Column('unit', sa.String(length=30), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['passport_id'], ['technical_passports.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('passport_id', 'field_key')
    )
    op.create_index(op.f('ix_technical_field_values_passport_id'), 'technical_field_values', ['passport_id'], unique=False)
    op.create_table('water_pipeline_specs',
    sa.Column('passport_id', sa.String(length=36), nullable=False),
    sa.Column('diameter_mm', sa.Float(), nullable=True),
    sa.Column('material', sa.String(length=100), nullable=True),
    sa.Column('length_m', sa.Float(), nullable=True),
    sa.Column('installation_depth_m', sa.Float(), nullable=True),
    sa.Column('pressure_kpa', sa.Float(), nullable=True),
    sa.Column('commissioning_date', sa.Date(), nullable=True),
    sa.ForeignKeyConstraint(['passport_id'], ['technical_passports.id'], ),
    sa.PrimaryKeyConstraint('passport_id')
    )
    # ### end Alembic commands ###


    op.execute("ALTER TABLE object_geometries ADD CONSTRAINT valid_object_geometry CHECK (ST_SRID(geom)=4326 AND NOT ST_IsEmpty(geom) AND ST_IsValid(geom))")
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='fvv_runtime') THEN CREATE ROLE fvv_runtime NOLOGIN; END IF;
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='fvv_public') THEN CREATE ROLE fvv_public NOLOGIN; END IF;
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='fvv_retention') THEN CREATE ROLE fvv_retention NOLOGIN; END IF;
        END $$;
        REVOKE CREATE ON SCHEMA public FROM PUBLIC;
        GRANT USAGE ON SCHEMA public TO fvv_runtime, fvv_public, fvv_retention;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fvv_runtime;
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs, object_revisions FROM fvv_runtime;
        GRANT SELECT ON public_objects, regions, districts, infrastructure_categories TO fvv_public;
        REVOKE ALL ON infrastructure_objects, object_geometries, technical_passports, hydrant_specs,
          water_pipeline_specs, sewer_specs, gas_specs, electrical_specs, users, auth_sessions, refresh_tokens,
          object_attachments, citizen_reports, audit_logs FROM fvv_public;
        GRANT fvv_runtime, fvv_public, fvv_retention TO CURRENT_USER;
    """)
    op.execute("""
        CREATE FUNCTION fvv_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_TABLE_NAME='audit_logs' AND TG_OP='DELETE'
               AND current_setting('fvv.audit_retention_delete', true)='on'
               AND pg_has_role(session_user,'fvv_retention','member') THEN RETURN OLD; END IF;
            RAISE EXCEPTION 'append-only record cannot be modified' USING ERRCODE='42501';
        END $$;
        CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION fvv_immutable_record();
        CREATE TRIGGER object_revisions_append_only BEFORE UPDATE OR DELETE ON object_revisions FOR EACH ROW EXECUTE FUNCTION fvv_immutable_record();
        CREATE FUNCTION fvv_purge_expired_audit(retention_days integer, policy_reference text)
        RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
        DECLARE deleted_count bigint;
        BEGIN
            IF retention_days <= 0 OR length(trim(policy_reference))=0 THEN
                RAISE EXCEPTION 'approved positive retention period and policy reference required';
            END IF;
            PERFORM set_config('fvv.audit_retention_delete','on',true);
            DELETE FROM audit_logs WHERE created_at < clock_timestamp()-make_interval(days=>retention_days);
            GET DIAGNOSTICS deleted_count=ROW_COUNT;
            PERFORM set_config('fvv.audit_retention_delete','off',true);
            RETURN deleted_count;
        END $$;
        REVOKE ALL ON FUNCTION fvv_purge_expired_audit(integer,text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION fvv_purge_expired_audit(integer,text) TO fvv_retention;
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS fvv_purge_expired_audit(integer,text)")
    op.execute("DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS object_revisions_append_only ON object_revisions")
    op.execute("DROP FUNCTION IF EXISTS fvv_immutable_record()")
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('water_pipeline_specs')
    op.drop_index(op.f('ix_technical_field_values_passport_id'), table_name='technical_field_values')
    op.drop_table('technical_field_values')
    op.drop_table('sewer_specs')
    op.drop_table('hydrant_specs')
    op.drop_table('gas_specs')
    op.drop_table('electrical_specs')
    op.drop_index(op.f('ix_approval_requests_status'), table_name='approval_requests')
    op.drop_index(op.f('ix_approval_requests_object_id'), table_name='approval_requests')
    op.drop_table('approval_requests')
    op.drop_table('technical_passports')
    op.drop_index(op.f('ix_refresh_tokens_session_id'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_table('public_objects')
    op.drop_index(op.f('ix_pipeline_connections_object_id'), table_name='pipeline_connections')
    op.drop_table('pipeline_connections')
    op.drop_index(op.f('ix_object_revisions_object_id'), table_name='object_revisions')
    op.drop_table('object_revisions')
    op.drop_index('idx_object_geometries_geom', table_name='object_geometries', postgresql_using='gist')
    op.drop_table('object_geometries')
    op.drop_index(op.f('ix_object_attachments_report_id'), table_name='object_attachments')
    op.drop_index(op.f('ix_object_attachments_object_id'), table_name='object_attachments')
    op.drop_table('object_attachments')
    op.drop_index(op.f('ix_maintenance_records_object_id'), table_name='maintenance_records')
    op.drop_table('maintenance_records')
    op.drop_index(op.f('ix_inspections_object_id'), table_name='inspections')
    op.drop_table('inspections')
    op.drop_index(op.f('ix_hydrant_measurements_object_id'), table_name='hydrant_measurements')
    op.drop_table('hydrant_measurements')
    op.drop_table('approved_routes')
    op.drop_table('user_profiles')
    op.drop_index(op.f('ix_role_assignments_user_id'), table_name='role_assignments')
    op.drop_table('role_assignments')
    op.drop_index(op.f('ix_offline_sync_operations_user_id'), table_name='offline_sync_operations')
    op.drop_table('offline_sync_operations')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_infrastructure_objects_sensitivity'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_region_id'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_organization_id'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_operational_status'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_lifecycle'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_district_id'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_deleted_at'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_created_by'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_code'), table_name='infrastructure_objects')
    op.drop_index(op.f('ix_infrastructure_objects_category_id'), table_name='infrastructure_objects')
    op.drop_table('infrastructure_objects')
    op.drop_index(op.f('ix_employee_verifications_user_id'), table_name='employee_verifications')
    op.drop_index(op.f('ix_employee_verifications_status'), table_name='employee_verifications')
    op.drop_table('employee_verifications')
    op.drop_index(op.f('ix_device_registrations_user_id'), table_name='device_registrations')
    op.drop_table('device_registrations')
    op.drop_index(op.f('ix_citizen_reports_user_id'), table_name='citizen_reports')
    op.drop_index(op.f('ix_citizen_reports_status'), table_name='citizen_reports')
    op.drop_index(op.f('ix_citizen_reports_region_id'), table_name='citizen_reports')
    op.drop_table('citizen_reports')
    op.drop_index(op.f('ix_auth_sessions_user_id'), table_name='auth_sessions')
    op.drop_table('auth_sessions')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_actor_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_index(op.f('ix_users_phone'), table_name='users')
    op.drop_table('users')
    op.drop_table('role_permissions')
    op.drop_table('organizations')
    op.drop_index(op.f('ix_districts_region_id'), table_name='districts')
    op.drop_table('districts')
    op.drop_table('category_schema_versions')
    op.drop_table('sync_counter')
    op.drop_index(op.f('ix_sync_changes_object_id'), table_name='sync_changes')
    op.drop_table('sync_changes')
    op.drop_table('roles')
    op.drop_index(op.f('ix_retention_deletions_report_id'), table_name='retention_deletions')
    op.drop_table('retention_deletions')
    op.drop_table('regions')
    op.drop_table('permissions')
    op.drop_index(op.f('ix_otp_challenges_phone'), table_name='otp_challenges')
    op.drop_table('otp_challenges')
    op.drop_table('infrastructure_categories')
    # ### end Alembic commands ###
