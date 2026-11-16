# Verification results

Only executed checks are recorded as successful. Source files, deployment configuration, and expected artifact paths do not prove a running integration or a successful Android build.

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

## Other application checks

- Administration panel: the earlier recorded run completed **8 tests** and a production build. Browser workflow and visual checks need a fresh recorded result before final acceptance.
- Flutter: dependency resolution and generated models exist. Analyzer/widget-test completion and APK/AAB generation have not yet been confirmed in this report.
- Operational scripts: the ops agent recorded **5 passing tests** for restore validation and Compose credential boundaries; use final consolidated results when available.

## External integrations and release status

- No live Eskiz SMS or Firebase push message was sent by these tests.
- No official dispatch service, production dataset, production hosting, real employee affiliation, or live citizen-service operation was exercised.
- S3, ClamAV, OSRM, signed release artifacts, restore exercises against operator backups, and production security/governance acceptance require their own execution evidence.
- An APK or AAB must not be reported as generated until the build succeeds and the artifact is verified to exist.

## Current continuation run — 2026-11-10 UTC

- Backend revalidation: **65 passed**; PostGIS migration and Redis readiness passed.
- Admin panel revalidation: **8 tests passed**; TypeScript/Vite production build passed.
- Operations scripts: **5 passed**.
- Flutter SDK source pinned at `3.47.8` was prepared under the workspace toolchain directory, but its Dart SDK bootstrap was blocked by the managed network policy (`storage.googleapis.com` returned HTTP 403). The environment configuration service also failed to save the required allowlist update. Therefore Flutter dependency resolution, code generation, analyzer, mobile tests, and Android APK/AAB builds remain **unrun**.
- No APK artifact exists from this run. Do not claim an APK until the Dart SDK download is allowed and the full Flutter/Gradle sequence completes.
- Once network access is available, the reproducible mobile sequence is: `flutter pub get --enforce-lockfile`; `dart run build_runner build --delete-conflicting-outputs`; `flutter analyze`; `flutter test`; `flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1`. For release, run the same checks followed by `flutter build apk --release` and `flutter build appbundle --release` with an approved HTTPS `/api/v1` URL and signing secrets supplied only through the protected environment.
