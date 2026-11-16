# Verification results

Only executed checks are recorded as successful. Source files, deployment configuration, and expected artifact paths do not prove a running integration or a working deployment.

## Backend — 2026-11-09 UTC

- Environment: Python 3.12.14; native PostgreSQL 17.11/PostGIS 3.5 in this workspace.
- `uv run --env-file ../../.env alembic current`: migration **0001 (head)**.
- `uv run --env-file ../../.env alembic check`: **no new upgrade operations detected**.
- `uv run --env-file ../../.env python -m pytest -q` from `services/api`: **65 passed, 1 warning in 17.32 seconds**.
- The warning is an upstream Starlette/httpx test-client deprecation. It did not fail a test.
- API launched on port 8000 using sanitized `.env.application` configuration, separate application/public database logins, and disabled access logs.
- Actual HTTP checks: `/health/ready` returned `ready`; public GIS returned the separately published synthetic feature; `/tiles/style.json` returned MapLibre style version 8.
- OpenAPI was exported from the application to [openapi.json](openapi.json).

The full PostgreSQL/API suite exercises:

1. Three employees create thirty records, independently reviewed and published, visible to appropriately scoped colleagues.
2. Citizen and pending-employee restrictions across passports, spatial queries, public tiles, attachments, and search.
3. Same-assignment RBAC/ABAC checks, explicit public publication, direct public database-role isolation, and append-only audit protection.
4. OTP registration, expiry, administrator MFA, challenge replay, rotating refresh-token reuse detection, and device logout.
5. Invalid WGS84 geometry, pipeline connectivity, nullable technical measurements, dated pressure observations, and kPa/bar/atm conversion.
6. Concurrent-edit conflicts, payload-bound idempotent synchronization, policy-epoch reset, and revoked-session replay.
7. Pending inspection/attachment visibility and registry filters that use only the reader's visible revision.
8. Upload quarantine and report ownership.
9. Approved retention policy enforcement, legal holds, failed-commit safety, retryable file deletion, and deletion-journal replay after restore.
10. Allowlisted pre-registration organization names, protected administrator grants, out-of-scope assignment replacement denial, recipient-only private notifications, and restricted public-notification review queues.
11. Immediate removal of consumed registration challenges and cleanup of expired authentication challenges without deleting active challenges.

## Single-site restructure — 2026-11-16 UTC

The Kotlin Android app, the Flutter app and their CI jobs were removed. `apps/admin-web` became `apps/web` and now serves visitors, citizens, employees and administrators.

Executed in this run, on Python 3.13 with native PostgreSQL 16 / PostGIS 3:

- `uv run alembic upgrade head`: migrations **0001 and 0002** applied.
- `uv run pytest -q` in `services/api`: **70 passed, 1 warning** (upstream Starlette/httpx deprecation).
- `python -m app.cli seed-demo`: 30 objects, 14 regions, 16 categories and the demo accounts.
- `npm test` in `apps/web`: **9 passed**. `npm run build` (TypeScript + Vite): passed.
- `python scripts/test_operations.py`: **5 passed**.
- `docker compose config` for the development, staging and production files: valid.

Browser run (headless Chromium against the live API and the Vite dev server), **12 of 12 steps passed**:

1. Public landing without sign-in: public map list, 112 notice, object selection and search filter.
2. Citizen registration with the development OTP.
3. Citizen navigation limited to public map, own reports, notifications and profile.
4. Report submission with browser geolocation, then the report detail view.
5. Notifications view as a citizen.
6. Profile name edit and active session list.
7. Sign-out back to the public page.
8. Phone and password sign-in.
9. Account deletion.
10. Employee application, which shows the pending-review notice.
11. Verified employee OTP sign-in: operational navigation without citizen items, registry table and profile.
12. Phone-width layout of the landing and registration pages without horizontal overflow.

A separate browser run submitted a report with a PNG attachment: the upload succeeded and the file was listed as quarantined, as expected without ClamAV.

## Not executed

- The basemap: no Martin tile server ran here, so tile requests returned 503 and the map showed objects on a blank background.
- The Docker stack itself (the Docker daemon was unavailable), including the gateway image build, Redis, S3, ClamAV and OSRM.
- Antivirus release of uploaded files (no ClamAV), live Eskiz SMS and Firebase push.
- No official dispatch service, production dataset, production hosting, real employee affiliation or live citizen-service operation was exercised.
