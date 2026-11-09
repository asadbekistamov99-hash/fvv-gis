"""Independent security and collaboration acceptance checks.

These checks use synthetic records and development authentication only. They do
not contact SMS, push, routing, or official emergency-dispatch services.
"""
from datetime import datetime, timezone
import math
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.geometry import parse_bbox, validate_geometry
from app.services.passports import validate_passport


@pytest.mark.parametrize(
    "geometry",
    [
        {"type": "Point", "coordinates": [181, 41]},
        {"type": "Point", "coordinates": [69, -91]},
        {"type": "Point", "coordinates": [True, 41]},
        {"type": "Point", "coordinates": [math.nan, 41]},
        {"type": "LineString", "coordinates": [[69, 41], [69, 41]]},
        {"type": "Polygon", "coordinates": [[[69, 41], [70, 42], [69, 42], [70, 41], [69, 41]]]},
        {"type": "Point", "coordinates": []},
    ],
)
def test_invalid_gps_geometry_is_rejected(geometry):
    with pytest.raises(HTTPException) as error:
        validate_geometry(geometry)
    assert error.value.status_code == 422


def test_pipeline_crossing_does_not_declare_connection():
    disconnected = {
        "type": "MultiLineString",
        "coordinates": [[[69, 41], [70, 42]], [[69, 42], [70, 41]]],
    }
    with pytest.raises(HTTPException) as error:
        validate_geometry(disconnected)
    assert error.value.status_code == 422

    connected = {
        "type": "MultiLineString",
        "coordinates": [[[69, 41], [70, 42]], [[70, 42], [70.5, 42.1]]],
    }
    assert validate_geometry(connected) == connected


@pytest.mark.parametrize("bbox", ["nan,40,70,42", "69,41,68,42", "69,41,70", "69,-91,70,42"])
def test_invalid_spatial_bounds_are_rejected(bbox):
    with pytest.raises(HTTPException) as error:
        parse_bbox(bbox)
    assert error.value.status_code == 422


def test_unknown_hydrant_measurements_remain_null():
    result = validate_passport("fire_hydrants", {})
    assert result["measured_pressure_kpa"] is None
    assert result["nominal_pressure_kpa"] is None
    assert result["flow_lps"] is None
    assert result["measurement_date"] is None
    assert "operational_status" not in result


@pytest.mark.parametrize("value", [{"measured_pressure": 2}, {"flow_lps": 10}])
def test_hydrant_measurements_require_a_date(value):
    with pytest.raises(HTTPException) as error:
        validate_passport("fire_hydrants", value)
    assert error.value.status_code == 422


@pytest.mark.parametrize("unit,pressure,expected", [("bar", 2.3, 230), ("atm", 1, 101.325), ("kPa", 0, 0)])
def test_pressure_conversion_preserves_date_and_explicit_zero(unit, pressure, expected):
    observed = datetime(2025, 1, 2, 3, 4, tzinfo=timezone.utc)
    result = validate_passport("fire_hydrants", {
        "measured_pressure": pressure,
        "pressure_unit": unit,
        "measurement_date": observed.isoformat(),
        "measurement_method": "Synthetic acceptance measurement",
    })
    assert result["measured_pressure_kpa"] == pytest.approx(expected)
    assert result["pressure_unit"] == "kPa"
    assert datetime.fromisoformat(result["measurement_date"].replace("Z", "+00:00")) == observed
    assert "measured_pressure" not in result


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf, True])
def test_extension_numbers_require_finite_nonboolean_values(value):
    with pytest.raises(HTTPException) as error:
        validate_passport("other", {"extensions": {"test_length": value}}, {
            "extensions": {"test_length": {"type": "number", "unit": "m"}},
        })
    assert error.value.status_code == 422


def test_undeclared_engineering_extensions_are_rejected():
    with pytest.raises(HTTPException) as error:
        validate_passport("other", {"extensions": {"unapproved_secret": "value"}})
    assert error.value.status_code == 422


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_client_synthetic_flag_cannot_bypass_live_intake_policy(monkeypatch, environment):
    from app.api.auth import intake_allowed
    from app.api.infrastructure import live_gate
    from app.core.config import settings

    monkeypatch.setattr(settings, "app_env", environment)
    monkeypatch.setattr(settings, "live_intake_enabled", False)
    monkeypatch.setattr(settings, "retention_policy_approved", False)
    for gate in (intake_allowed, live_gate):
        with pytest.raises(HTTPException) as error:
            gate(True)
        assert error.value.status_code == 503


def _organization(db):
    from app.models import Organization

    row = Organization(name=f"SYNTHETIC QA {uuid4().hex[:8]}", region_id="UZ-TK", is_synthetic=True)
    db.add(row)
    db.flush()
    return row


def _actor(db, *, role="verified_employee", organization=None, region="UZ-TK", sensitivity="confidential"):
    from app.api.auth import issue_session
    from app.db.base import utcnow
    from app.models import RoleAssignment, User, UserProfile

    organization = organization or _organization(db)
    user = User(
        phone=f"+99890{int(uuid4().hex[:10], 16) % 10_000_000:07d}",
        full_name=f"SYNTHETIC QA {role}",
        role=role,
        employee_status="pending_verification" if role == "pending_employee" else "none" if role == "citizen" else "verified",
        organization_id=organization.id,
        region_id=region,
        is_synthetic=True,
        phone_verified_at=utcnow(),
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id))
    if role not in {"citizen", "pending_employee"}:
        db.add(RoleAssignment(user_id=user.id, role_id=role, region_id=region,
                              organization_id=organization.id, max_sensitivity=sensitivity))
    db.flush()
    # Exercise the real signed-token/session validation path without sending OTPs
    # for fixture identities. OTP/MFA flows have their own endpoint tests.
    tokens = issue_session(db, user, device_id=f"qa-{uuid4().hex}", mfa_verified=True)
    db.commit()
    return user, {"Authorization": f"Bearer {tokens['access_token']}"}


def _payload(db, organization, *, index=0, region="UZ-TK", sensitivity="internal"):
    from sqlalchemy import select
    from app.models import InfrastructureCategory

    category = db.scalar(select(InfrastructureCategory.id).where(InfrastructureCategory.id.contains("hydrant")))
    assert category is not None, "The seeded registry must include fire hydrants"
    return {
        "code": f"QA-{uuid4().hex[:10]}-{index}",
        "name": f"SYNTHETIC PRIVATE QA {uuid4().hex[:10]}",
        "category_id": category,
        "region_id": region,
        "organization_id": organization.id,
        "geometry": {"type": "Point", "coordinates": [69.2 + index * 0.0001, 41.3]},
        "operational_status": "faulty",
        "sensitivity": sensitivity,
        "passport": {"notes": "PRIVATE QA PASSPORT", "measured_pressure_kpa": None, "flow_lps": None},
        "is_synthetic": True,
    }


def _create(client, db, organization, headers, **overrides):
    payload = _payload(db, organization)
    payload.update(overrides)
    response = client.post("/api/v1/infrastructure", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _publish(client, record, author, reviewer):
    for path, headers in (
        (f"/infrastructure/{record['id']}/submit", author),
        (f"/infrastructure/{record['id']}/review", reviewer),
        (f"/approvals/{record['id']}/approve", reviewer),
        (f"/infrastructure/{record['id']}/publish", reviewer),
    ):
        response = client.post(f"/api/v1{path}", json={"expected_version": record["version"]}, headers=headers)
        assert response.status_code == 200, response.text
        record = response.json()
    assert record["lifecycle"] == "published"
    return record


def test_three_employees_share_thirty_approved_published_records(client, db):
    organization = _organization(db)
    writers = [_actor(db, organization=organization)[1] for _ in range(3)]
    _, reviewer = _actor(db, role="data_reviewer", organization=organization)
    created = []
    for employee_index, headers in enumerate(writers):
        for item_index in range(10):
            created.append((_create(client, db, organization, headers,
                                    code=f"QA-30-{uuid4().hex[:8]}-{employee_index}-{item_index}"), headers))

    first_id = created[0][0]["id"]
    assert client.get(f"/api/v1/infrastructure/{first_id}", headers=writers[1]).status_code == 404
    before = client.get("/api/v1/gis/objects", headers=writers[1])
    assert before.status_code == 200
    assert not before.json()["features"]

    expected = set()
    for record, author in created:
        published = _publish(client, record, author, reviewer)
        expected.add(published["id"])
    assert len(expected) == 30
    for headers in writers:
        response = client.get("/api/v1/gis/objects", headers=headers)
        assert response.status_code == 200, response.text
        features = response.json()["features"]
        assert {feature["id"] for feature in features} == expected
        assert all(feature["properties"]["operational_status"] == "faulty" for feature in features)


def test_citizen_and_pending_employee_cannot_read_private_gis(client, db):
    organization = _organization(db)
    _, author = _actor(db, organization=organization)
    _, reviewer = _actor(db, role="data_reviewer", organization=organization)
    record = _publish(client, _create(client, db, organization, author), author, reviewer)
    for role in ("citizen", "pending_employee"):
        _, headers = _actor(db, role=role, organization=organization)
        for path in (
            f"/infrastructure/{record['id']}",
            "/infrastructure",
            "/gis/objects?bbox=69,41,70,42",
            "/gis/nearby?longitude=69.2&latitude=41.3&radius_m=1000",
            f"/infrastructure/{record['id']}/attachments",
            f"/infrastructure/{record['id']}/history",
        ):
            response = client.get(f"/api/v1{path}", headers=headers)
            assert response.status_code in {403, 404}, (path, response.text)
            assert "PRIVATE QA PASSPORT" not in response.text
            assert record["name"] not in response.text
        denied = client.post("/api/v1/infrastructure", json=_payload(db, organization), headers=headers)
        assert denied.status_code == 403, denied.text
        escalation = client.patch("/api/v1/users/me", json={"role": "super_administrator"}, headers=headers)
        assert escalation.status_code == 422

    public = client.get("/api/v1/public/gis/objects")
    assert public.status_code == 200, public.text
    assert record["id"] not in public.text
    assert record["name"] not in public.text
    assert "PRIVATE QA PASSPORT" not in public.text
    tile = client.get("/api/v1/public/gis/tiles/0/0/0.pbf")
    assert tile.status_code == 200
    assert record["id"].encode() not in tile.content
    assert record["name"].encode() not in tile.content


def test_public_publication_is_separate_and_allowlisted(client, db):
    organization = _organization(db)
    _, author = _actor(db, organization=organization)
    _, reviewer = _actor(db, role="data_reviewer", organization=organization)
    record = _publish(client, _create(client, db, organization, author, sensitivity="public"), author, reviewer)
    assert record["name"] not in client.get("/api/v1/public/gis/objects").text
    response = client.post(f"/api/v1/infrastructure/{record['id']}/publish-public", headers=reviewer)
    assert response.status_code == 200, response.text
    public_id = response.json()["id"]
    public = client.get("/api/v1/public/gis/objects").json()
    feature = next(feature for feature in public["features"] if feature["id"] == public_id)
    assert public_id != record["id"]
    assert feature["properties"]["name"] == record["name"]
    forbidden = {"passport", "object_id", "created_by", "updated_by", "organization_id", "responsible_employee_id", "published_by", "sensitivity"}
    assert forbidden.isdisjoint(feature["properties"])
    assert "PRIVATE QA PASSPORT" not in str(feature)


def test_scoped_roles_cannot_borrow_permissions_from_other_assignments(client, db):
    from app.models import RoleAssignment

    organization = _organization(db)
    mixed, mixed_headers = _actor(db, organization=organization, region=None)
    db.add(RoleAssignment(user_id=mixed.id, role_id="data_reviewer", region_id="UZ-AN",
                          organization_id=organization.id, max_sensitivity="confidential"))
    db.commit()
    _, author = _actor(db, organization=organization)
    record = _create(client, db, organization, author)
    submitted = client.post(f"/api/v1/infrastructure/{record['id']}/submit", json={"expected_version": record["version"]}, headers=author)
    assert submitted.status_code == 200, submitted.text
    denied = client.post(f"/api/v1/infrastructure/{record['id']}/review", headers=mixed_headers)
    assert denied.status_code in {403, 404}, denied.text
    queue = client.get("/api/v1/approvals/pending", headers=mixed_headers)
    assert queue.status_code == 200, queue.text
    assert record["id"] not in {item["id"] for item in queue.json()["items"]}


def test_concurrent_edit_preserves_first_change_and_returns_conflict(client, db):
    organization = _organization(db)
    _, author = _actor(db, organization=organization)
    record = _create(client, db, organization, author)
    first = client.patch(f"/api/v1/infrastructure/{record['id']}", json={"expected_version": record["version"], "name": "QA first accepted change"}, headers=author)
    assert first.status_code == 200, first.text
    conflict = client.patch(f"/api/v1/infrastructure/{record['id']}", json={"expected_version": record["version"], "name": "QA stale change"}, headers=author)
    assert conflict.status_code == 409, conflict.text
    current = client.get(f"/api/v1/infrastructure/{record['id']}", headers=author)
    assert current.status_code == 200
    assert current.json()["name"] == "QA first accepted change"


def test_revoked_session_cannot_read_or_submit_more_data(client, db):
    organization = _organization(db)
    _, headers = _actor(db, organization=organization)
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200
    logout = client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 200, logout.text
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401
    assert client.post("/api/v1/infrastructure", json=_payload(db, organization), headers=headers).status_code == 401


def test_account_deletion_succeeds_and_revokes_session(client, db):
    user, headers = _actor(db, role="citizen")
    response = client.delete("/api/v1/users/me", headers=headers)
    assert response.status_code == 200, response.text
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401
    db.refresh(user)
    assert not user.is_active
    assert user.deleted_at is not None
    assert user.full_name == "O‘chirilgan hisob"


def test_nearby_uses_meters_and_published_geometry(client, db):
    organization = _organization(db)
    _, author = _actor(db, organization=organization)
    _, reviewer = _actor(db, role="data_reviewer", organization=organization)
    record = _publish(client, _create(client, db, organization, author), author, reviewer)
    params = {"longitude": 69.201, "latitude": 41.3, "radius_m": 100}
    nearby = client.get("/api/v1/gis/nearby", params=params, headers=author)
    assert nearby.status_code == 200, nearby.text
    feature = next(item for item in nearby.json()["features"] if item["id"] == record["id"])
    # A longitude difference of .001 degrees near 41N is approximately84m.
    assert 70 < feature["properties"]["distance_m"] < 100
    smaller = client.get("/api/v1/gis/nearby", params={**params, "radius_m": 50}, headers=author)
    assert smaller.status_code == 200
    assert record["id"] not in {item["id"] for item in smaller.json()["features"]}


def test_upload_quarantine_and_object_authorization(client, db, monkeypatch, tmp_path):
    import base64
    from app.api import uploads
    from app.core.config import settings

    monkeypatch.setattr(settings, "upload_directory", tmp_path)
    monkeypatch.setattr(settings, "storage_backend", "local")
    monkeypatch.setattr(uploads, "queue_scan", lambda _: None)
    organization = _organization(db)
    _, author = _actor(db, organization=organization)
    _, citizen = _actor(db, role="citizen", organization=organization)
    record = _create(client, db, organization, author)
    bad = client.post("/api/v1/attachments", data={"object_id": record["id"]},
                      files={"file": ("fake.png", b"not an image", "image/png")}, headers=author)
    assert bad.status_code == 422, bad.text
    png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=")
    response = client.post("/api/v1/attachments", data={"object_id": record["id"]},
                           files={"file": ("../../private.png", png, "image/png")}, headers=author)
    assert response.status_code == 201, response.text
    attachment = response.json()
    assert attachment["filename"] == "private.png"
    assert attachment["scan_status"] == "quarantined"
    assert "storage_key" not in attachment
    locked = client.get(f"/api/v1/attachments/{attachment['id']}/download", headers=author)
    assert locked.status_code == 423
    for suffix in ("", "/download"):
        denied = client.get(f"/api/v1/attachments/{attachment['id']}{suffix}", headers=citizen)
        assert denied.status_code in {403, 404}
        assert "private.png" not in denied.text


def test_citizens_can_only_track_their_own_reports(client, db):
    _, author = _actor(db, role="citizen")
    _, stranger = _actor(db, role="citizen")
    response = client.post("/api/v1/reports", json={
        "category": "infrastructure_fault",
        "description": "SYNTHETIC QA non-emergency case",
        "geometry": {"type": "Point", "coordinates": [69.2, 41.3]},
        "region_id": "UZ-TK", "is_synthetic": True,
    }, headers=author)
    assert response.status_code == 201, response.text
    record = response.json()
    assert record["status"] == "received"
    mine = client.get("/api/v1/reports/my", headers=author)
    assert mine.status_code == 200
    assert record["id"] in {row["id"] for row in mine.json()["items"]}
    denied = client.get(f"/api/v1/reports/{record['id']}", headers=stranger)
    assert denied.status_code in {403, 404}
    assert "SYNTHETIC QA non-emergency case" not in denied.text
    assert client.get("/api/v1/reports", headers=author).status_code == 403


def test_author_cannot_review_or_approve_own_submission(client, db):
    organization = _organization(db)
    _, author = _actor(db, role="regional_supervisor", organization=organization)
    record = _create(client, db, organization, author)
    response = client.post(f"/api/v1/infrastructure/{record['id']}/submit",
                           json={"expected_version": record["version"]}, headers=author)
    assert response.status_code == 200, response.text
    reviewed = client.post(f"/api/v1/infrastructure/{record['id']}/review", headers=author)
    assert reviewed.status_code == 403, reviewed.text
    approved = client.post(f"/api/v1/approvals/{record['id']}/approve", headers=author)
    assert approved.status_code in {403, 409}, approved.text


def test_published_scope_cannot_change_while_old_revision_remains_authoritative(client, db):
    organization = _organization(db)
    _, author = _actor(db, organization=organization, region=None)
    _, reviewer = _actor(db, role="data_reviewer", organization=organization, region=None)
    record = _publish(client, _create(client, db, organization, author), author, reviewer)
    response = client.patch(f"/api/v1/infrastructure/{record['id']}", json={
        "expected_version": record["version"], "region_id": "UZ-AN",
    }, headers=author)
    assert response.status_code == 409, response.text
    current = client.get(f"/api/v1/infrastructure/{record['id']}", headers=author)
    assert current.status_code == 200
    assert current.json()["region_id"] == "UZ-TK"


def test_sync_replay_is_idempotent_and_changed_payload_is_rejected(client, db):
    from sqlalchemy import select, func
    from app.models import InfrastructureObject

    organization = _organization(db)
    user, author = _actor(db, organization=organization)
    operation_id = str(uuid4())
    payload = _payload(db, organization)
    batch = {"policy_epoch": user.policy_epoch, "device_id": "qa-device", "operations": [{
        "operation_id": operation_id, "action": "create", "data": payload,
    }]}
    first = client.post("/api/v1/sync/batch", json=batch, headers=author)
    assert first.status_code == 200, first.text
    first_result = first.json()["results"][0]
    assert first_result["status"] == "success", first_result
    repeated = client.post("/api/v1/sync/batch", json=batch, headers=author)
    assert repeated.status_code == 200, repeated.text
    assert repeated.json()["results"][0] == first_result
    assert db.scalar(select(func.count()).select_from(InfrastructureObject).where(
        InfrastructureObject.code == payload["code"]
    )) == 1
    batch["operations"][0]["data"]["name"] = "SYNTHETIC changed operation payload"
    changed = client.post("/api/v1/sync/batch", json=batch, headers=author)
    assert changed.status_code == 200
    result = changed.json()["results"][0]
    assert result["status"] == "conflict"
    assert result["error"]["status_code"] == 409


def test_sync_conflict_preserves_accepted_edit_and_policy_change_requires_reset(client, db):
    from app.api.auth import issue_session

    organization = _organization(db)
    user, author = _actor(db, organization=organization)
    record = _create(client, db, organization, author)
    accepted = client.patch(f"/api/v1/infrastructure/{record['id']}", json={
        "expected_version": record["version"], "name": "Accepted online revision",
    }, headers=author)
    assert accepted.status_code == 200, accepted.text
    stale = client.post("/api/v1/sync/batch", json={
        "policy_epoch": user.policy_epoch,
        "operations": [{"operation_id": str(uuid4()), "action": "update", "object_id": record["id"],
                        "expected_version": record["version"], "data": {"name": "Stale offline revision"}}],
    }, headers=author)
    assert stale.status_code == 200, stale.text
    assert stale.json()["results"][0]["status"] == "conflict"
    assert client.get(f"/api/v1/infrastructure/{record['id']}", headers=author).json()["name"] == "Accepted online revision"

    old_epoch = user.policy_epoch
    user.policy_epoch += 1
    db.commit()
    assert client.get("/api/v1/sync/changes", headers=author).status_code == 401
    tokens = issue_session(db, user, "reauthorized-qa-device", mfa_verified=True)
    db.commit()
    renewed = {"Authorization": f"Bearer {tokens['access_token']}"}
    reset = client.get("/api/v1/sync/changes", params={"policy_epoch": old_epoch}, headers=renewed)
    assert reset.status_code == 409, reset.text
    assert reset.json()["detail"]["reset_required"] is True


def test_revoked_session_cannot_replay_successful_sync_result(client, db):
    organization = _organization(db)
    user, author = _actor(db, organization=organization)
    batch = {"policy_epoch": user.policy_epoch, "operations": [{
        "operation_id": str(uuid4()), "action": "create", "data": _payload(db, organization),
    }]}
    created = client.post("/api/v1/sync/batch", json=batch, headers=author)
    assert created.status_code == 200
    assert created.json()["results"][0]["status"] == "success"
    assert client.post("/api/v1/auth/logout", headers=author).status_code == 200
    revoked = client.post("/api/v1/sync/batch", json=batch, headers=author)
    assert revoked.status_code == 401
    assert "PRIVATE QA PASSPORT" not in revoked.text


def test_public_database_role_cannot_select_restricted_tables(db):
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError

    with db.begin_nested():
        db.execute(text("SET LOCAL ROLE fvv_public"))
        assert db.execute(text("SELECT count(*) FROM public_objects")).scalar() is not None
        with pytest.raises(DBAPIError) as error:
            with db.begin_nested():
                db.execute(text("SELECT id FROM infrastructure_objects LIMIT 1"))
        assert getattr(error.value.orig, "sqlstate", None) == "42501"
        db.execute(text("RESET ROLE"))


def test_public_gis_routes_use_the_restricted_public_database_dependency():
    from fastapi.routing import APIRoute
    from app.api.gis import router
    from app.db.session import get_public_db

    def dependency_calls(dependant):
        return {dependant.call} | {
            call for dependency in dependant.dependencies for call in dependency_calls(dependency)
        }

    # FastAPI includes routers lazily; inspect the owning router's dependency graph.
    public_routes = [route for route in router.routes if isinstance(route, APIRoute)
                     and route.path.startswith("/public/gis/")]
    assert public_routes, "Public GIS routes must be present"
    assert all(get_public_db in dependency_calls(route.dependant) for route in public_routes)


def test_audit_rows_cannot_be_rewritten_or_deleted_by_application_connection(db):
    from sqlalchemy import select, text
    from sqlalchemy.exc import DBAPIError
    from app.models import AuditLog

    user, _ = _actor(db, role="system_administrator")
    row = AuditLog(actor_id=user.id, action="qa.audit.original", target_type="qa")
    db.add(row)
    db.commit()
    for statement in (
        "UPDATE audit_logs SET action='qa.audit.forged' WHERE id=:id",
        "DELETE FROM audit_logs WHERE id=:id",
    ):
        with pytest.raises(DBAPIError):
            with db.begin_nested():
                db.execute(text(statement), {"id": row.id})
    assert db.scalar(select(AuditLog.action).where(AuditLog.id == row.id)) == "qa.audit.original"


def test_colleagues_cannot_read_or_modify_another_employees_pending_inspections(client, db):
    organization = _organization(db)
    _, author = _actor(db, organization=organization)
    _, colleague = _actor(db, organization=organization)
    record = _create(client, db, organization, author)
    inspection = client.post("/api/v1/inspections", json={
        "object_id": record["id"], "condition": "Synthetic private condition",
        "notes": "PRIVATE PENDING INSPECTION NOTES", "operational_status": "faulty",
    }, headers=author)
    assert inspection.status_code == 201, inspection.text
    maintenance = client.post(f"/api/v1/infrastructure/{record['id']}/maintenance", json={
        "description": "PRIVATE PENDING MAINTENANCE NOTES", "performed_at": datetime.now(timezone.utc).isoformat(),
    }, headers=author)
    assert maintenance.status_code == 201, maintenance.text
    for suffix in ("inspections", "maintenance"):
        denied = client.get(f"/api/v1/infrastructure/{record['id']}/{suffix}", headers=colleague)
        assert denied.status_code in {403, 404}, (suffix, denied.text)
        assert "PRIVATE PENDING" not in denied.text
    visible = client.get("/api/v1/inspections", headers=colleague)
    assert visible.status_code == 200
    assert inspection.json()["id"] not in {item["id"] for item in visible.json()["items"]}
    denied_write = client.post("/api/v1/inspections", json={
        "object_id": record["id"], "condition": "Unapproved colleague inspection", "operational_status": "unknown",
    }, headers=colleague)
    assert denied_write.status_code in {403, 404}, denied_write.text


def test_original_creator_cannot_read_another_editors_unapproved_attachments(client, db):
    from app.db.base import utcnow
    from app.models import ObjectAttachment

    organization = _organization(db)
    _, original_author = _actor(db, organization=organization)
    editor, editor_headers = _actor(db, organization=organization)
    _, reviewer = _actor(db, role="data_reviewer", organization=organization)
    record = _publish(client, _create(client, db, organization, original_author), original_author, reviewer)
    edited = client.patch(f"/api/v1/infrastructure/{record['id']}", json={
        "expected_version": record["version"], "name": "PRIVATE UNAPPROVED EDITOR DRAFT",
    }, headers=editor_headers)
    assert edited.status_code == 200, edited.text
    attachment = ObjectAttachment(
        object_id=record["id"], uploaded_by=editor.id, filename="PRIVATE UNAPPROVED PHOTO.jpg",
        content_type="image/jpeg", size_bytes=3, storage_key=f"quarantine/{uuid4()}",
        sha256="0" * 64, scan_status="quarantined", created_at=utcnow(),
    )
    db.add(attachment)
    db.commit()
    metadata = client.get(f"/api/v1/attachments/{attachment.id}", headers=original_author)
    assert metadata.status_code in {403, 404}, metadata.text
    listed = client.get(f"/api/v1/infrastructure/{record['id']}/attachments", headers=original_author)
    assert listed.status_code == 200, listed.text
    assert attachment.id not in {item["id"] for item in listed.json()["items"]}
    assert "PRIVATE UNAPPROVED PHOTO" not in listed.text
    assert client.get(f"/api/v1/attachments/{attachment.id}", headers=editor_headers).status_code == 200


def test_registry_search_and_status_filters_only_use_the_readers_visible_revision(client, db):
    organization = _organization(db)
    _, original_author = _actor(db, organization=organization)
    _, editor = _actor(db, organization=organization)
    _, reader = _actor(db, organization=organization)
    _, reviewer = _actor(db, role="data_reviewer", organization=organization)
    record = _publish(client, _create(client, db, organization, original_author,
                                    operational_status="working"), original_author, reviewer)
    pending_name = f"PRIVATE-DRAFT-SEARCH-{uuid4().hex}"
    edited = client.patch(f"/api/v1/infrastructure/{record['id']}", json={
        "expected_version": record["version"], "name": pending_name, "operational_status": "faulty",
    }, headers=editor)
    assert edited.status_code == 200, edited.text
    hidden = client.get("/api/v1/infrastructure", params={"search": pending_name}, headers=reader)
    assert hidden.status_code == 200, hidden.text
    assert hidden.json()["items"] == []
    assert hidden.json()["total"] == 0
    faulty = client.get("/api/v1/infrastructure", params={"status": "faulty"}, headers=reader)
    assert faulty.status_code == 200
    assert record["id"] not in {item["id"] for item in faulty.json()["items"]}
    published = client.get("/api/v1/infrastructure", params={"status": "working", "lifecycle": "published"}, headers=reader)
    assert published.status_code == 200, published.text
    visible = next(item for item in published.json()["items"] if item["id"] == record["id"])
    assert visible["name"] == record["name"]


def test_pre_registration_organization_catalog_exposes_only_approved_names(client, db, monkeypatch):
    from app.api.gis import registration_organizations
    from app.core.config import settings
    from app.models import Organization

    demo = _organization(db)
    private = Organization(name=f"PRIVATE-ORGANIZATION-{uuid4().hex}", is_synthetic=False, region_id="UZ-TK")
    db.add(private)
    db.commit()
    assert client.get("/api/v1/organizations").status_code in {401, 403}
    response = client.get("/api/v1/public/registration/organizations")
    assert response.status_code == 200
    assert demo.id in {row["id"] for row in response.json()["items"]}
    assert private.id not in {row["id"] for row in response.json()["items"]}
    assert all(set(row) == {"id", "name"} for row in response.json()["items"])

    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "registration_organization_ids", "")
    assert registration_organizations(db) == {"items": [], "total": 0}
    monkeypatch.setattr(settings, "registration_organization_ids", private.id)
    assert registration_organizations(db) == {"items": [{"id": private.id, "name": private.name}], "total": 1}


def test_admin_assignment_preload_hides_out_of_scope_grants_and_prevents_replacement(client, db):
    from sqlalchemy import select
    from app.models import RoleAssignment

    organization = _organization(db)
    admin, headers = _actor(db, role="system_administrator", organization=organization)
    employee, _ = _actor(db, organization=organization, sensitivity="restricted")
    original = db.scalar(select(RoleAssignment).where(RoleAssignment.user_id == employee.id))
    original.categories = ["fire_hydrant"]
    db.add(RoleAssignment(user_id=employee.id, role_id="verified_employee", region_id="UZ-BU",
                          organization_id=organization.id, max_sensitivity="internal"))
    db.commit()
    response = client.get("/api/v1/admin/users", headers=headers)
    assert response.status_code == 200, response.text
    person = next(row for row in response.json()["items"] if row["id"] == employee.id)
    assert person["assignments_complete"] is False
    assert len(person["assignments"]) == 1
    assert person["assignments"][0]["max_sensitivity"] == "restricted"
    assert person["assignments"][0]["categories"] == ["fire_hydrant"]
    assert person["assignments"][0]["region_id"] == "UZ-TK"
    replacement = {"role": "verified_employee", "region_id": "UZ-TK", "organization_id": organization.id}
    assert client.post(f"/api/v1/admin/users/{employee.id}/roles", json=replacement, headers=headers).status_code == 403
    assert len(db.scalars(select(RoleAssignment).where(RoleAssignment.user_id == employee.id)).all()) == 2


def test_system_administrator_cannot_demote_other_administrators(client, db):
    organization = _organization(db)
    _, headers = _actor(db, role="system_administrator", organization=organization)
    for role in ("system_administrator", "super_administrator"):
        target, _ = _actor(db, role=role, organization=organization)
        replacement = {"role": "verified_employee", "region_id": "UZ-TK", "organization_id": organization.id}
        assert client.post(f"/api/v1/admin/users/{target.id}/roles", json=replacement, headers=headers).status_code == 403
        assert target.role == role


def test_private_notification_details_stay_in_authenticated_recipient_api(client, db):
    from app.models import RoleAssignment
    from sqlalchemy import select

    organization = _organization(db)
    admin, sender = _actor(db, role="system_administrator", organization=organization)
    # Public review is a global operator action, separate from regional access.
    assignment = db.scalar(select(RoleAssignment).where(RoleAssignment.user_id == admin.id))
    assignment.region_id = assignment.organization_id = None
    db.commit()
    recipient, recipient_headers = _actor(db, organization=organization)
    _, other_headers = _actor(db, organization=organization)
    secret = f"PRIVATE-NOTIFICATION-{uuid4().hex}"
    response = client.post("/api/v1/notifications", headers=sender, json={
        "title": "Private operator notice", "body": secret, "user_id": recipient.id,
    })
    assert response.status_code == 201, response.text
    assert response.json()["body"] == secret
    assert secret in client.get("/api/v1/notifications", headers=recipient_headers).text
    assert secret not in client.get("/api/v1/notifications", headers=other_headers).text
    assert client.get("/api/v1/notifications", params={"include_pending": True}, headers=other_headers).status_code == 403
    pending = client.post("/api/v1/notifications", headers=sender, json={
        "title": "Unreviewed public announcement", "body": "Awaiting explicit review", "is_public": True,
    })
    assert pending.status_code == 201
    pending_id = pending.json()["id"]
    assert pending_id not in {row["id"] for row in client.get("/api/v1/notifications", headers=other_headers).json()["items"]}
    review_queue = client.get("/api/v1/notifications", params={"include_pending": True}, headers=sender)
    assert review_queue.status_code == 200
    assert pending_id in {row["id"] for row in review_queue.json()["items"]}


def test_blank_optional_retention_environment_values_are_unconfigured(monkeypatch):
    from app.core.config import Settings

    for name in ("REPORT_RETENTION_DAYS", "AUDIT_RETENTION_DAYS", "BACKUP_RETENTION_DAYS"):
        monkeypatch.setenv(name, "")
    config = Settings(_env_file=None, app_env="test")
    assert config.report_retention_days is None
    assert config.audit_retention_days is None
    assert config.backup_retention_days is None
    assert config.live_policy_ready is False
