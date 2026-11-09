#!/usr/bin/env python3
"""Restore encrypted snapshots and replay the latest deletion journal before reopening."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def values_from_environment():
    values = {}
    for line in (ROOT / '.env').read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key] = value.strip().strip('"').strip("'")
    values.update(os.environ)
    return values


def checked_path(directory, filename):
    if not isinstance(filename, str) or filename != Path(filename).name:
        raise ValueError('Unsafe manifest filename')
    target = directory / filename
    if not target.is_file() or target.is_symlink():
        raise ValueError('Snapshot file is missing or is a symlink')
    return target


def verify_manifest(manifest_path):
    manifest = json.loads(manifest_path.read_text())
    files = {}
    for name in ('database', 'objects', 'deletion-ledger'):
        entry = manifest['files'][name]
        target = checked_path(manifest_path.parent, entry['name'])
        with target.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if digest != entry['sha256']:
            raise ValueError(f'Snapshot checksum mismatch: {name}')
        files[name] = target
    return files


def decrypt(source, identity, destination):
    with destination.open('wb') as output:
        subprocess.run(['age', '-d', '-i', str(identity), str(source)], stdout=output, check=True)
    destination.chmod(0o600)


def extract_regular_files(archive_path, destination):
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    root = destination.resolve()
    with tarfile.open(archive_path) as archive:
        for item in archive:
            relative = Path(item.name)
            if relative.is_absolute() or '..' in relative.parts or not (item.isfile() or item.isdir()):
                raise ValueError('Unsafe path, link, or special file in snapshot')
            target = destination / relative
            if root not in target.resolve().parents and target.resolve() != root:
                raise ValueError('Snapshot path escapes restore destination')
            if target.is_symlink():
                raise ValueError('Restore destination contains a symlink')
            if item.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o700)
                continue
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with archive.extractfile(item) as source, target.open('wb') as output:
                shutil.copyfileobj(source, output)
            target.chmod(0o600)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--identity', type=Path, required=True, help='Protected age identity file')
    parser.add_argument('--latest-ledger', type=Path, required=True, help='Latest separately preserved encrypted ledger, including events after the snapshot')
    parser.add_argument('--objects', choices=['local', 's3'], required=True)
    parser.add_argument('--confirm-database-replacement', action='store_true')
    args = parser.parse_args()
    values = values_from_environment()
    if not args.confirm_database_replacement or values.get('RESTORE_MAINTENANCE', '').lower() != 'true':
        parser.error('Stop API/workers, set RESTORE_MAINTENANCE=true, and explicitly confirm database replacement.')
    if values.get('LIVE_INTAKE_ENABLED', '').lower() == 'true':
        raise SystemExit('Disable live intake before restoring.')
    if not shutil.which('age'):
        raise SystemExit('Install age before restoring.')
    if not values.get('RETENTION_LEDGER_DIRECTORY'):
        raise SystemExit('RETENTION_LEDGER_DIRECTORY is required.')
    files = verify_manifest(args.manifest.resolve())
    restore_url = values.get('RESTORE_DATABASE_URL') or values.get('MIGRATION_DATABASE_URL')
    if not restore_url:
        raise SystemExit('Supply RESTORE_DATABASE_URL or MIGRATION_DATABASE_URL through the environment.')
    parsed = urlsplit(restore_url.replace('postgresql+psycopg://', 'postgresql://', 1))
    with tempfile.TemporaryDirectory(prefix='fvv-restore-') as temporary:
        stage = Path(temporary)
        for name, source in files.items():
            decrypt(source, args.identity, stage / name)
        decrypt(args.latest_ledger, args.identity, stage / 'latest-ledger')
        # Validate every archive before changing the database.
        for name in ('objects', 'deletion-ledger', 'latest-ledger'):
            extract_regular_files(stage / name, stage / f'{name}-files')
        env = os.environ.copy()
        env['PGPASSWORD'] = unquote(parsed.password or '')
        command = [values.get('PG_RESTORE_PATH', 'pg_restore'), '--clean', '--if-exists', '--no-owner', '--no-acl',
                   '-h', parsed.hostname or 'localhost', '-p', str(parsed.port or 5432),
                   '-U', unquote(parsed.username or ''), '-d', parsed.path.lstrip('/'), str(stage / 'database')]
        subprocess.run(command, env=env, check=True)
        if args.objects == 'local':
            destination = Path(values.get('UPLOAD_DIRECTORY', 'var/uploads'))
            if not destination.is_absolute():
                destination = ROOT / 'services/api' / destination
            extract_regular_files(stage / 'objects', destination)
        else:
            import boto3
            client = boto3.client('s3', endpoint_url=values['S3_ENDPOINT_URL'],
                                  aws_access_key_id=values['S3_ACCESS_KEY'], aws_secret_access_key=values['S3_SECRET_KEY'])
            source_root = stage / 'objects-files'
            for source in source_root.rglob('*'):
                if source.is_file():
                    client.upload_file(str(source), values['S3_BUCKET'], str(source.relative_to(source_root)))
        ledger = Path(values['RETENTION_LEDGER_DIRECTORY'])
        ledger.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Merge rather than replace: the separate latest ledger is authoritative over older snapshots.
        for name in ('deletion-ledger-files', 'latest-ledger-files'):
            for source in (stage / name).glob('*.json'):
                target = ledger / source.name
                if target.exists() and json.loads(target.read_text()) != json.loads(source.read_text()):
                    raise RuntimeError('Deletion journal mismatch; keep service stopped for review.')
                shutil.copyfile(source, target)
                target.chmod(0o600)
        replay_env = {**values, 'DATABASE_URL': restore_url}
        subprocess.run([sys.executable, '-m', 'app.worker', '--replay-deletions'],
                       cwd=ROOT / 'services/api', env=replay_env, check=True)
    print('Restore and latest deletion replay completed. Keep services stopped until migrations, role checks, and acceptance checks pass.')


if __name__ == '__main__':
    main()
