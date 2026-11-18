#!/usr/bin/env python3
"""Load release signing secrets in CI; never create a fallback release identity."""
import base64
import os
from pathlib import Path

required = ['KEYSTORE_BASE64', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']
if any(not os.environ.get(name) for name in required):
    raise SystemExit('All Android signing secrets must be configured.')
root = Path(__file__).resolve().parents[1] / 'apps/mobile/android'
root.mkdir(parents=True, exist_ok=True)
keystore = root / 'release.keystore'
keystore.write_bytes(base64.b64decode(os.environ['KEYSTORE_BASE64'], validate=True))
keystore.chmod(0o600)
def escaped(value):
    return value.replace('\\', '\\\\').replace('\n', '\\n').replace('\r', '\\r').replace('=', '\\=').replace(':', '\\:')
properties = root / 'key.properties'
properties.write_text('\n'.join([
    'storeFile=' + escaped(str(keystore.resolve())),
    'storePassword=' + escaped(os.environ['KEYSTORE_PASSWORD']),
    'keyAlias=' + escaped(os.environ['KEY_ALIAS']),
    'keyPassword=' + escaped(os.environ['KEY_PASSWORD']),
]) + '\n')
properties.chmod(0o600)
print('Signing configuration prepared; no values printed.')
