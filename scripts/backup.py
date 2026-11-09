#!/usr/bin/env python3
"""Stream encrypted database, private objects and deletion-ledger backups."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import time
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]

def load_env():
    values = {}
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                values[key] = value.strip().strip('"').strip("'")
    values.update(os.environ)
    return values

values = load_env()
parser = argparse.ArgumentParser()
parser.add_argument('--directory', type=Path, default=ROOT / 'backups')
parser.add_argument('--objects', choices=['local', 's3'], required=True)
args = parser.parse_args()
recipient = values.get('BACKUP_AGE_RECIPIENT', '')
ledger = Path(values.get('RETENTION_LEDGER_DIRECTORY', ''))
try:
    retention_days = int(values['BACKUP_RETENTION_DAYS'])
except (KeyError, ValueError):
    raise SystemExit('An approved BACKUP_RETENTION_DAYS is required; no default policy is assumed.')
if values.get('RETENTION_POLICY_APPROVED', '').lower() != 'true' or retention_days <= 0:
    raise SystemExit('Operator retention policy approval is required.')
if not recipient or not shutil.which('age'):
    raise SystemExit('Install age and configure BACKUP_AGE_RECIPIENT (public recipient key).')
if not values.get('RETENTION_LEDGER_DIRECTORY') or not ledger.is_dir():
    raise SystemExit('A separate durable RETENTION_LEDGER_DIRECTORY must exist.')
args.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
args.directory.chmod(0o700)
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
manifest = {'created_at': stamp, 'files': {}, 'retention_days': retention_days}

def encrypt(name, producer):
    target = args.directory / f'fvv-{stamp}-{name}.age'
    partial = target.with_suffix('.age.partial')
    with partial.open('wb') as output:
        process = subprocess.Popen(['age', '-r', recipient], stdin=subprocess.PIPE, stdout=output)
        try:
            producer(process.stdin)
            process.stdin.close()
            if process.wait() != 0:
                raise RuntimeError('age encryption failed')
        except BaseException:
            process.kill()
            process.wait()
            partial.unlink(missing_ok=True)
            raise
    partial.chmod(0o600)
    partial.replace(target)
    with target.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    manifest['files'][name] = {'name': target.name, 'sha256': digest}
    return target

def dump_database(output):
    parsed = urlsplit(values['DATABASE_URL'].replace('postgresql+psycopg://', 'postgresql://', 1))
    env = os.environ.copy()
    env['PGPASSWORD'] = unquote(parsed.password or '')
    command = [values.get('PG_DUMP_PATH', 'pg_dump'), '-Fc', '--no-owner', '--no-acl',
               '-h', parsed.hostname or 'localhost', '-p', str(parsed.port or 5432),
               '-U', unquote(parsed.username or ''), '-d', parsed.path.lstrip('/')]
    subprocess.run(command, env=env, stdout=output, check=True)

def tar_directory(output, path):
    with tarfile.open(fileobj=output, mode='w|') as archive:
        for entry in sorted(path.rglob('*')):
            if entry.is_symlink():
                raise RuntimeError('Backup directory contains a symlink; review before backing up.')
            if entry.is_file():
                archive.add(entry, arcname=str(entry.relative_to(path)), recursive=False)

def tar_s3(output):
    import boto3
    client = boto3.client('s3', endpoint_url=values['S3_ENDPOINT_URL'],
                          aws_access_key_id=values['S3_ACCESS_KEY'], aws_secret_access_key=values['S3_SECRET_KEY'])
    bucket = values['S3_BUCKET']
    with tarfile.open(fileobj=output, mode='w|') as archive:
        for page in client.get_paginator('list_objects_v2').paginate(Bucket=bucket):
            for item in page.get('Contents', []):
                key = item['Key']
                if key.startswith('/') or '..' in Path(key).parts:
                    raise RuntimeError('Unsafe object key in private bucket')
                response = client.get_object(Bucket=bucket, Key=key)
                info = tarfile.TarInfo(key)
                info.size = response['ContentLength']
                info.mode = 0o600
                archive.addfile(info, response['Body'])
                response['Body'].close()

encrypt('database', dump_database)
if args.objects == 'local':
    uploads = Path(values.get('UPLOAD_DIRECTORY', str(ROOT / 'services/api/var/uploads')))
    if not uploads.is_absolute():
        uploads = ROOT / 'services/api' / uploads
    uploads.mkdir(parents=True, exist_ok=True)
    encrypt('objects', lambda output: tar_directory(output, uploads))
else:
    encrypt('objects', tar_s3)
ledger_file = encrypt('deletion-ledger', lambda output: tar_directory(output, ledger))
# Preserve a latest deletion ledger independently of older snapshot expiry.
latest = args.directory / 'retention-ledger-latest.tar.age'
shutil.copyfile(ledger_file, latest)
latest.chmod(0o600)
(args.directory / f'fvv-{stamp}-manifest.json').write_text(json.dumps(manifest, indent=2))
threshold = time.time() - retention_days * 86400
for path in args.directory.glob('fvv-*'):
    if path.is_file() and path.stat().st_mtime < threshold:
        path.unlink()
print('Encrypted snapshot completed. Copy snapshot and latest deletion ledger to separate protected storage.')
