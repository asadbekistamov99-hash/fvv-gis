#!/usr/bin/env python3
"""Fetch public ODbL basemap and OFL font; never import infrastructure records."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'data/maps'
parser = argparse.ArgumentParser()
parser.add_argument('--sha256', default='0eb60ce67b9eedee26c005becb95f4d423f03e248cfcac8c6790850ae8645516', help='Require the operator-reviewed basemap SHA256 when supplied')
args = parser.parse_args()
TARGET.mkdir(parents=True, exist_ok=True)

def fetch(url, target, expected=None):
    if not target.exists():
        part = target.with_suffix(target.suffix + '.part')
        with urllib.request.urlopen(url, timeout=120) as response, part.open('wb') as output:
            while data := response.read(1024 * 1024):
                output.write(data)
        part.replace(target)
    digest = hashlib.file_digest(target.open('rb'), 'sha256').hexdigest()
    if expected and digest != expected:
        raise SystemExit(f'Checksum mismatch: {target.name}; file retained for investigation, do not serve it.')
    return {'url': url, 'sha256': digest, 'bytes': target.stat().st_size}

manifest = {'basemap': fetch('https://download.geofabrik.de/asia/uzbekistan-shortbread-1.0.mbtiles', TARGET / 'uzbekistan.mbtiles', args.sha256)}
fonts = TARGET / 'fonts'
fonts.mkdir(exist_ok=True)
manifest['font'] = fetch('https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf', fonts / 'NotoSans-Regular.ttf')
manifest['font_license'] = fetch('https://raw.githubusercontent.com/notofonts/noto-fonts/main/LICENSE', fonts / 'OFL.txt')
manifest['attribution'] = '© OpenStreetMap contributors; Geofabrik; ODbL 1.0; Shortbread schema CC0; Noto Sans SIL OFL 1.1'
(TARGET / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('Public basemap ready:', manifest['basemap']['bytes'], 'bytes')
print('Pin this reviewed SHA256 for reproducible deployment:', manifest['basemap']['sha256'])
