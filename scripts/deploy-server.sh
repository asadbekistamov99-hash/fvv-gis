#!/usr/bin/env bash
# Install or update the FVV GIS backend on one Ubuntu 22.04/24.04 server.
#
# The website itself is hosted separately (for example on Vercel) and calls
# this server directly at https://$API_DOMAIN. This server runs PostgreSQL/PostGIS,
# Redis, the API, the background worker, private S3 storage, optional ClamAV,
# the Martin basemap and the Caddy gateway with automatic HTTPS.
#
# Run as root on the server, after the API_DOMAIN DNS record points to it:
#
#   API_DOMAIN=api.example.uz ACME_EMAIL=admin@example.uz bash deploy-server.sh
#
# Optional settings:
#   WEB_ORIGIN     website origin allowed by CORS   (default https://hozak-nine.vercel.app)
#   BRANCH         git branch to deploy            (default main)
#   REPO_URL       git repository                  (default the public GitHub URL below)
#   INSTALL_DIR    checkout location               (default /opt/fvv-gis)
#   WITH_SCANNING  1 runs ClamAV (needs ~3 GB RAM)  (default 1)
#   WITH_MAPS      1 downloads and serves the basemap (default 1)
#   ESKIZ_EMAIL, ESKIZ_PASSWORD, ESKIZ_SENDER   Eskiz SMS account; without it nobody can sign in
#   ADMIN_PHONE, ADMIN_NAME   create the first super administrator (MFA enforced at first sign-in)
#
# Re-running is safe: secrets in .env are kept and only listed settings are updated.
set -euo pipefail

: "${API_DOMAIN:?Set API_DOMAIN, for example api.example.uz}"
: "${ACME_EMAIL:?Set ACME_EMAIL for the HTTPS certificate}"
WEB_ORIGIN="${WEB_ORIGIN:-https://hozak-nine.vercel.app}"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/asadbekistamov99-hash/fvv-gis.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/fvv-gis}"
WITH_SCANNING="${WITH_SCANNING:-1}"
WITH_MAPS="${WITH_MAPS:-1}"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*" >&2; }

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root (for example with sudo)." >&2
  exit 1
fi
if [[ ! "$API_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "API_DOMAIN must be a bare host name such as api.example.uz" >&2
  exit 1
fi
if [[ ! "$WEB_ORIGIN" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
  echo "WEB_ORIGIN must look like https://site.example (no path)" >&2
  exit 1
fi

log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git python3 docker.io docker-compose-v2 >/dev/null
systemctl enable --now docker >/dev/null

log "Fetching the code ($BRANCH)"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
else
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

log "Preparing secrets and settings"
python3 scripts/init-env.py
set_env() {
  python3 - "$1" "$2" <<'PY'
import sys
from pathlib import Path
key, value = sys.argv[1], sys.argv[2]
path = Path('.env')
lines = path.read_text().splitlines()
lines = [line for line in lines if not line.startswith(key + '=')] + [f'{key}={value}']
path.write_text('\n'.join(lines) + '\n')
path.chmod(0o600)
PY
}
get_env() {
  python3 - "$1" <<'PY'
import sys
from pathlib import Path
for line in Path('.env').read_text().splitlines():
    if line.startswith(sys.argv[1] + '='):
        print(line.split('=', 1)[1])
PY
}
set_env APP_ENV production
set_env DEV_OTP_ENABLED false
set_env ALLOW_SYNTHETIC_REGISTRATION false
set_env SITE_ADDRESS "$API_DOMAIN"
set_env ACME_EMAIL "$ACME_EMAIL"
set_env CORS_ORIGINS "$WEB_ORIGIN"
set_env PUBLIC_BASE_URL "https://$API_DOMAIN"
set_env STORAGE_BACKEND s3
if [[ "$WITH_SCANNING" == "1" ]]; then set_env CLAMAV_HOST clamav; else set_env CLAMAV_HOST ""; fi
if [[ -n "${ESKIZ_EMAIL:-}" && -n "${ESKIZ_PASSWORD:-}" ]]; then
  set_env SMS_PROVIDER eskiz
  set_env ESKIZ_EMAIL "$ESKIZ_EMAIL"
  set_env ESKIZ_PASSWORD "$ESKIZ_PASSWORD"
  if [[ -n "${ESKIZ_SENDER:-}" ]]; then set_env ESKIZ_SENDER "$ESKIZ_SENDER"; fi
fi

compose() { scripts/compose -f infrastructure/deployment/compose.server.yml "$@"; }
OWNER_URL="$(get_env CONTAINER_DATABASE_URL)"
# One-off maintenance commands run as the database owner in development mode,
# because production validation needs the restricted roles they create.
maintenance() {
  compose run --rm --no-deps -T \
    -e APP_ENV=development -e DEV_OTP_ENABLED=false -e STORAGE_BACKEND=local \
    -e DATABASE_URL="$OWNER_URL" -e PUBLIC_DATABASE_URL= "$@"
}

profiles=(--profile gateway --profile jobs --profile storage)
if [[ "$WITH_SCANNING" == "1" ]]; then profiles+=(--profile scanning); fi
if [[ "$WITH_MAPS" == "1" ]]; then
  log "Downloading the public basemap (OpenStreetMap, ODbL)"
  if python3 scripts/fetch-map.py; then
    profiles+=(--profile maps)
  else
    warn "Basemap download or checksum check failed; continuing without the basemap."
  fi
fi

log "Building images"
compose "${profiles[@]}" build --quiet

log "Starting database, Redis and storage"
compose "${profiles[@]}" up -d --wait db redis
compose "${profiles[@]}" up -d storage

log "Applying database migrations"
maintenance api alembic upgrade head

log "Creating least-privilege database roles"
maintenance --user 0 -v "$INSTALL_DIR:/repo" -w /repo api python scripts/configure-db-roles.py

log "Loading regions, categories and roles"
maintenance api python -m app.cli seed-catalog

log "Creating the private storage bucket"
S3_ADMIN_ACCESS_KEY="$(get_env S3_ADMIN_ACCESS_KEY)" \
S3_ADMIN_SECRET_KEY="$(get_env S3_ADMIN_SECRET_KEY)" \
S3_BUCKET="$(get_env S3_BUCKET)" \
  compose run --rm --no-deps -T -e S3_ADMIN_ACCESS_KEY -e S3_ADMIN_SECRET_KEY -e S3_BUCKET api python - <<'PY'
import os, time
import boto3
from botocore.exceptions import ClientError, EndpointConnectionError
client = boto3.client('s3', endpoint_url='http://storage:8333', region_name='us-east-1',
                      aws_access_key_id=os.environ['S3_ADMIN_ACCESS_KEY'],
                      aws_secret_access_key=os.environ['S3_ADMIN_SECRET_KEY'])
bucket = os.environ['S3_BUCKET']
for attempt in range(30):
    try:
        client.create_bucket(Bucket=bucket)
        print('bucket created')
        break
    except ClientError as error:
        if error.response.get('Error', {}).get('Code') in ('BucketAlreadyOwnedByYou', 'BucketAlreadyExists'):
            print('bucket exists')
            break
        if attempt == 29:
            raise
    except EndpointConnectionError:
        if attempt == 29:
            raise
    time.sleep(2)
PY

if [[ -n "${ADMIN_PHONE:-}" && -n "${ADMIN_NAME:-}" ]]; then
  log "Creating the first administrator"
  maintenance api python -m app.cli create-admin --phone "$ADMIN_PHONE" --name "$ADMIN_NAME" \
    || warn "Administrator was not created (it may already exist)."
fi

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  log "Opening ports 80 and 443 in ufw"
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

log "Starting all services"
compose "${profiles[@]}" up -d

log "Checking https://$API_DOMAIN"
for _ in $(seq 1 30); do
  if curl -fsS --max-time 10 "https://$API_DOMAIN/api/v1/public/config" >/dev/null 2>&1; then
    echo "API is reachable over HTTPS."
    break
  fi
  sleep 10
done || true
if ! curl -fsS --max-time 10 "https://$API_DOMAIN/api/v1/public/config" >/dev/null 2>&1; then
  warn "The API did not answer over HTTPS yet. Check that DNS for $API_DOMAIN points here and ports 80/443 are open, then run: cd $INSTALL_DIR && scripts/compose -f infrastructure/deployment/compose.server.yml logs gateway api"
fi

cat <<EOF

Done. The API is served at https://$API_DOMAIN/api/v1 and the basemap at https://$API_DOMAIN/tiles/style.json.

Next steps:
  1. In the website's Vercel project set these production environment variables, then redeploy:
       VITE_API_URL=https://$API_DOMAIN/api/v1
       VITE_MAP_STYLE_URL=https://$API_DOMAIN/tiles/style.json
  2. Sign-in needs an Eskiz SMS account. Re-run this script with ESKIZ_EMAIL and ESKIZ_PASSWORD set.
  3. To create the first administrator, re-run this script with ADMIN_PHONE and ADMIN_NAME set.
  4. Real citizen reports open only after the operator details and approved retention policy
     are set in $INSTALL_DIR/.env (see docs/OPERATIONS.md) and LIVE_INTAKE_ENABLED=true.
EOF
