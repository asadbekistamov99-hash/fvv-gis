#!/usr/bin/env python3
"""Create least-privilege login roles after migrations without exposing passwords."""
import os
from pathlib import Path
import secrets
from urllib.parse import quote, unquote, urlsplit

import psycopg
from psycopg import sql

ROOT = Path(__file__).resolve().parents[1]
APPLICATION_KEYS = {
    'APP_ENV', 'SECRET_KEY', 'DEV_OTP_ENABLED', 'ALLOW_SYNTHETIC_REGISTRATION',
    'REGISTRATION_ORGANIZATION_IDS', 'ACCESS_TOKEN_MINUTES', 'REFRESH_TOKEN_DAYS',
    'OTP_TTL_SECONDS', 'OTP_MAX_ATTEMPTS', 'OTP_RESEND_SECONDS',
    'SMS_PROVIDER', 'ESKIZ_EMAIL', 'ESKIZ_PASSWORD', 'ESKIZ_SENDER', 'ESKIZ_BASE_URL',
    'CORS_ORIGINS', 'PUBLIC_BASE_URL', 'MAP_STYLE_URL', 'MAP_STYLE_FILE', 'TILES_UPSTREAM_URL',
    'LIVE_INTAKE_ENABLED', 'OPERATOR_NAME', 'OPERATOR_CONTACT', 'RESPONSIBLE_TEAM',
    'RETENTION_POLICY_REFERENCE', 'RETENTION_POLICY_APPROVED', 'REPORT_RETENTION_DAYS',
    'AUDIT_RETENTION_DAYS', 'BACKUP_RETENTION_DAYS', 'RETENTION_LEDGER_DIRECTORY',
    'OFFLINE_LEASE_HOURS', 'REDIS_URL', 'STORAGE_BACKEND', 'UPLOAD_DIRECTORY', 'UPLOAD_MAX_BYTES',
    'S3_ENDPOINT_URL', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET', 'CLAMAV_HOST', 'CLAMAV_PORT',
    'FIREBASE_CREDENTIALS_PATH', 'OSRM_URL', 'OSRM_SOURCE_DATE',
}


def load_values():
    values = {}
    for line in (ROOT / '.env').read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key] = value.strip().strip('"').strip("'")
    values.update(os.environ)
    return values


def main():
    values = load_values()
    owner_url = values.get('MIGRATION_DATABASE_URL') or values['DATABASE_URL']
    parsed = urlsplit(owner_url.replace('postgresql+psycopg://', 'postgresql://', 1))
    output = ROOT / '.env.runtime'
    previous = {}
    if output.exists():
        for line in output.read_text().splitlines():
            if '=' in line:
                key, value = line.split('=', 1)
                previous[key] = value
    passwords = {}
    roles = [('DATABASE_URL', 'fvv_api_login', 'fvv_runtime'),
             ('PUBLIC_DATABASE_URL', 'fvv_public_login', 'fvv_public'),
             ('RETENTION_DATABASE_URL', 'fvv_retention_login', 'fvv_retention')]
    with psycopg.connect(owner_url.replace('postgresql+psycopg://', 'postgresql://', 1), autocommit=True) as connection:
        for key, name, group in roles:
            old = previous.get(key)
            password = unquote(urlsplit(old).password) if old else secrets.token_urlsafe(36)
            passwords[key] = password
            found = connection.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', (name,)).fetchone()
            if not found:
                connection.execute(sql.SQL('CREATE ROLE {} LOGIN').format(sql.Identifier(name)))
            connection.execute(sql.SQL('ALTER ROLE {} WITH LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION').format(
                sql.Identifier(name), sql.Literal(password)))
            connection.execute(sql.SQL('GRANT {} TO {}').format(sql.Identifier(group), sql.Identifier(name)))
    host = parsed.hostname or '127.0.0.1'
    host = f'[{host}]' if ':' in host else host
    port = parsed.port or 5432
    database = parsed.path.lstrip('/')
    lines = []
    for key, name, _ in roles:
        lines.append(f'{key}=postgresql+psycopg://{name}:{quote(passwords[key], safe="")}@{host}:{port}/{database}')
    lines.append(f'CONTAINER_DATABASE_URL=postgresql+psycopg://fvv_api_login:{quote(passwords["DATABASE_URL"], safe="")}@db:5432/{database}')
    lines.append(f'CONTAINER_PUBLIC_DATABASE_URL=postgresql+psycopg://fvv_public_login:{quote(passwords["PUBLIC_DATABASE_URL"], safe="")}@db:5432/{database}')
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as file:
        file.write('\n'.join(lines) + '\n')
    output.chmod(0o600)
    # Keep operator credentials in .env/.env.runtime; only allowlisted application
    # settings and runtime/public URLs are copied into the API startup file.
    application = {key: value for key, value in values.items() if key in APPLICATION_KEYS and value != ''}
    application.update(dict(line.split('=', 1) for line in lines[:2]))
    application_path = ROOT / '.env.application'
    descriptor = os.open(application_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as file:
        file.write(''.join(f'{key}={value}\n' for key, value in sorted(application.items())))
    application_path.chmod(0o600)
    print('Least-privilege database URLs written to .env.runtime (private; values not printed).')
    print('API settings written separately to .env.application; operator credentials are excluded.')


if __name__ == '__main__':
    main()
