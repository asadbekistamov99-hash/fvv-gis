"""Security boundary checks for recovery archives; no live database is changed."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('restore_operations', Path(__file__).with_name('restore.py'))
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)


class RecoveryBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def archive(self, name='safe/item.txt', *, link=False):
        target = self.root / 'input.tar'
        with tarfile.open(target, 'w') as archive:
            info = tarfile.TarInfo(name)
            if link:
                info.type = tarfile.SYMTYPE
                info.linkname = '/etc/passwd'
                archive.addfile(info)
            else:
                data = b'synthetic private content'
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
        return target

    def test_regular_snapshot_files_restore_with_private_permissions(self):
        destination = self.root / 'restore'
        restore.extract_regular_files(self.archive(), destination)
        restored = destination / 'safe/item.txt'
        self.assertEqual(restored.read_bytes(), b'synthetic private content')
        self.assertEqual(restored.stat().st_mode & 0o777, 0o600)

    def test_path_traversal_is_rejected_without_writing_outside_destination(self):
        with self.assertRaises(ValueError):
            restore.extract_regular_files(self.archive('../../escape'), self.root / 'restore')
        self.assertFalse((self.root / 'escape').exists())

    def test_symlink_members_are_rejected(self):
        with self.assertRaises(ValueError):
            restore.extract_regular_files(self.archive(link=True), self.root / 'restore')

    def test_manifest_checksum_detects_tampering(self):
        entries = {}
        for name in ('database', 'objects', 'deletion-ledger'):
            filename = f'{name}.age'
            target = self.root / filename
            target.write_bytes(b'encrypted placeholder')
            entries[name] = {'name': filename, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        manifest = self.root / 'manifest.json'
        manifest.write_text(json.dumps({'files': entries}))
        self.assertEqual(set(restore.verify_manifest(manifest)), set(entries))
        (self.root / 'database.age').write_bytes(b'tampered')
        with self.assertRaises(ValueError):
            restore.verify_manifest(manifest)


class DeploymentCredentialTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('docker'), 'Docker Compose CLI is not installed')
    def test_api_and_worker_never_receive_operator_credentials(self):
        project = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as temporary:
            configuration = Path(temporary) / 'synthetic.env'
            configuration.write_text('\n'.join([
                'POSTGRES_DB=synthetic_test', 'POSTGRES_USER=synthetic_owner',
                'POSTGRES_PASSWORD=synthetic-owner-secret',
                'CONTAINER_DATABASE_URL=postgresql+psycopg://api:synthetic@db/synthetic_test',
                'CONTAINER_PUBLIC_DATABASE_URL=postgresql+psycopg://public:synthetic@db/synthetic_test',
                'SECRET_KEY=synthetic-test-secret-with-at-least-forty-characters',
                'MIGRATION_DATABASE_URL=must-not-reach-api',
                'RETENTION_DATABASE_URL=must-not-reach-api',
                'S3_ADMIN_ACCESS_KEY=must-not-reach-api',
                'S3_ADMIN_SECRET_KEY=must-not-reach-api',
            ]) + '\n')
            configuration.chmod(0o600)
            result = subprocess.run([
                'docker', 'compose', '--profile', 'jobs', '--env-file', str(configuration),
                '-f', str(project / 'infrastructure/docker/compose.yml'),
                'config', '--format', 'json',
            ], env=os.environ.copy(), capture_output=True, text=True, check=True, timeout=20)
            services = json.loads(result.stdout)['services']
            forbidden = {'POSTGRES_PASSWORD', 'MIGRATION_DATABASE_URL', 'RESTORE_DATABASE_URL',
                         'RETENTION_DATABASE_URL', 'S3_ADMIN_ACCESS_KEY', 'S3_ADMIN_SECRET_KEY'}
            for name in ('api', 'worker'):
                keys = set(services[name]['environment'])
                self.assertTrue({'DATABASE_URL', 'PUBLIC_DATABASE_URL', 'SECRET_KEY'} <= keys)
                self.assertFalse(forbidden & keys, f'Operator credentials leaked into {name}')


if __name__ == '__main__':
    unittest.main()
