#!/usr/bin/env python3
"""Generate local-only secrets without printing them; preserve existing settings."""
from pathlib import Path
import json
import os
import secrets
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / '.env'
settings = {}
if path.exists():
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            settings[key] = value

def default(key, value):
    settings.setdefault(key, value)

default('POSTGRES_DB', 'fvv_gis')
default('POSTGRES_USER', 'fvv_owner')
default('POSTGRES_PASSWORD', secrets.token_urlsafe(32))
credentials = quote(settings['POSTGRES_USER'], safe='') + ':' + quote(settings['POSTGRES_PASSWORD'], safe='')
default('DATABASE_URL', f"postgresql+psycopg://{credentials}@127.0.0.1:5432/{settings['POSTGRES_DB']}")
default('CONTAINER_DATABASE_URL', f"postgresql+psycopg://{credentials}@db:5432/{settings['POSTGRES_DB']}")
default('SECRET_KEY', settings.get('JWT_SECRET') or secrets.token_urlsafe(48))
for key, value in {
    'APP_ENV': 'development', 'DEV_OTP_ENABLED': 'true', 'SMS_PROVIDER': 'development',
    'ALLOW_SYNTHETIC_REGISTRATION': 'true', 'LIVE_INTAKE_ENABLED': 'false',
    'REDIS_URL': 'redis://127.0.0.1:6379/0', 'STORAGE_BACKEND': 'local',
    'UPLOAD_DIRECTORY': 'var/uploads', 'OFFLINE_LEASE_HOURS': '8',
    'PUBLIC_BASE_URL': 'http://localhost:8000', 'MAP_STYLE_URL': '/tiles/style.json',
    'SITE_ADDRESS': ':8080', 'ACME_EMAIL': '', 'ESKIZ_EMAIL': '', 'ESKIZ_PASSWORD': '',
    'ESKIZ_SENDER': '4546', 'FIREBASE_CREDENTIALS_PATH': '',
    'OPERATOR_NAME': '', 'OPERATOR_CONTACT': '', 'RESPONSIBLE_TEAM': '',
    'RETENTION_POLICY_REFERENCE': '', 'RETENTION_POLICY_APPROVED': 'false',
    'S3_ENDPOINT_URL': 'http://127.0.0.1:8333', 'S3_BUCKET': 'fvv-private',
    'OSRM_URL': 'http://127.0.0.1:5001', 'CLAMAV_HOST': '',
}.items():
    default(key, value)
default('S3_ACCESS_KEY', secrets.token_hex(12))
default('S3_SECRET_KEY', secrets.token_urlsafe(36))
default('S3_ADMIN_ACCESS_KEY', secrets.token_hex(12))
default('S3_ADMIN_SECRET_KEY', secrets.token_urlsafe(36))
# No retention-day defaults: an approved operator policy is required for live data.
path.write_text(''.join(f'{key}={value}\n' for key, value in settings.items()))
path.chmod(0o600)
private = ROOT / '.secrets'
private.mkdir(mode=0o700, exist_ok=True)
s3_path = private / 's3.json'
bucket = settings['S3_BUCKET']
s3_path.write_text(json.dumps({'identities': [
    {'name': 'application', 'credentials': [{'accessKey': settings['S3_ACCESS_KEY'], 'secretKey': settings['S3_SECRET_KEY']}],
     'actions': [f'Read:{bucket}', f'Write:{bucket}', f'List:{bucket}', f'Tagging:{bucket}']},
    {'name': 'storage-operator', 'credentials': [{'accessKey': settings['S3_ADMIN_ACCESS_KEY'], 'secretKey': settings['S3_ADMIN_SECRET_KEY']}], 'actions': ['Admin']},
]}, indent=2))
s3_path.chmod(0o600)
print('Mahalliy .env va .secrets/s3.json tayyor. Sir qiymatlari chiqarilmadi.')
