"""Real database/API authentication checks; development OTP never sends external messages."""
from datetime import timedelta
from uuid import uuid4

import pyotp
from sqlalchemy import select

from app.db.base import utcnow
from app.models import EmployeeVerification, OTPChallenge, Organization, RoleAssignment, User, UserProfile


def phone():
    return f"+99890{int(uuid4().hex[:10], 16) % 10_000_000:07d}"


def register(client, **fields):
    payload = {"phone": phone(), "password": "Parol2026x", "full_name": "SINTETIK TEST", "account_type": "citizen", "is_synthetic": True, **fields}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 202, response.text
    return payload, response.json()


def verify(client, challenge):
    response = client.post("/api/v1/auth/verify-phone", json={
        "challenge_id": challenge["challenge_id"], "code": challenge["dev_otp"], "device_id": "qa-auth-device",
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_citizen_registration_otp_session_and_refresh_rotation(client):
    _, challenge = register(client)
    wrong = "000000" if challenge["dev_otp"] != "000000" else "111111"
    assert client.post("/api/v1/auth/verify-phone", json={"challenge_id": challenge["challenge_id"], "code": wrong}).status_code == 400
    tokens = verify(client, challenge)
    assert tokens["user"]["role"] == "citizen"
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200
    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert rotated.status_code == 200, rotated.text
    assert rotated.json()["refresh_token"] != tokens["refresh_token"]
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {rotated.json()['access_token']}"}).status_code == 401


def test_phone_and_password_registration_then_password_login(client, db):
    payload, challenge = register(client)
    tokens = verify(client, challenge)
    assert tokens["user"]["role"] == "citizen"
    stored = db.scalar(select(User).where(User.phone == payload["phone"]))
    assert stored.password_hash and "Parol2026x" not in stored.password_hash
    ok = client.post("/api/v1/auth/login/password", json={"phone": payload["phone"], "password": "Parol2026x"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["user"]["phone"] == payload["phone"]
    wrong = client.post("/api/v1/auth/login/password", json={"phone": payload["phone"], "password": "Notogri999"})
    assert wrong.status_code == 401
    unknown = client.post("/api/v1/auth/login/password", json={"phone": phone(), "password": "Parol2026x"})
    assert unknown.status_code == 401 and unknown.json()["detail"]["code"] == "invalid_credentials"


def test_password_login_never_grants_administrators(client, db):
    from app.core.security import hash_password
    admin = User(phone=phone(), full_name="SINTETIK ADMIN", role="system_administrator", is_synthetic=True,
                 phone_verified_at=utcnow(), password_hash=hash_password("Parol2026x"))
    db.add(admin)
    db.flush()
    response = client.post("/api/v1/auth/login/password", json={"phone": admin.phone, "password": "Parol2026x"})
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "otp_required"


def test_registration_requires_letter_and_digit_password(client):
    response = client.post("/api/v1/auth/register", json={
        "phone": phone(), "password": "onlyletters", "full_name": "SINTETIK TEST", "is_synthetic": True,
    })
    assert response.status_code == 422


def test_registration_rejects_client_role_injection_and_expired_otp(client, db):
    response = client.post("/api/v1/auth/register", json={
        "phone": phone(), "full_name": "SINTETIK TEST", "is_synthetic": True, "role": "super_administrator",
    })
    assert response.status_code == 422
    _, challenge = register(client)
    row = db.get(OTPChallenge, challenge["challenge_id"])
    row.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.post("/api/v1/auth/verify-phone", json={"challenge_id": row.id, "code": challenge["dev_otp"]}).status_code == 400


def test_employee_application_requires_independent_approval(client, db):
    org = Organization(name="SINTETIK QA tashkilot", is_synthetic=True)
    db.add(org)
    db.flush()
    _, challenge = register(client, account_type="employee", organization_id=org.id,
                            department="Sinov bo‘limi", region_id="UZ-TK", requested_role="super_administrator")
    pending = verify(client, challenge)
    assert pending["user"]["role"] == "pending_employee"
    assert pending["user"]["employee_status"] == "pending_verification"
    pending_headers = {"Authorization": f"Bearer {pending['access_token']}"}
    assert client.get("/api/v1/infrastructure", headers=pending_headers).status_code == 403
    admin = User(phone=phone(), full_name="SINTETIK QA admin", role="super_administrator", employee_status="verified", is_synthetic=True)
    db.add(admin)
    db.flush()
    db.add(UserProfile(user_id=admin.id))
    db.add(RoleAssignment(user_id=admin.id, role_id="super_administrator", max_sensitivity="confidential"))
    db.flush()
    from app.api.auth import issue_session
    admin_token = issue_session(db, admin, mfa_verified=True)["access_token"]
    db.commit()
    verification = db.scalar(select(EmployeeVerification).where(EmployeeVerification.user_id == pending["user"]["id"]))
    decision = client.post(f"/api/v1/admin/employee-verifications/{verification.id}/approve", headers={"Authorization": f"Bearer {admin_token}"},
                           json={"role": "verified_employee", "region_id": "UZ-TK", "organization_id": org.id, "reference": "SYNTHETIC-APPROVED"})
    assert decision.status_code == 200, decision.text
    assert decision.json()["role"] == "verified_employee"
    assert client.get("/api/v1/users/me", headers=pending_headers).status_code == 401


def test_administrator_must_enroll_mfa_and_cannot_reuse_challenge(client, db):
    admin = User(phone=phone(), full_name="SINTETIK QA MFA", role="system_administrator", employee_status="verified", is_synthetic=True)
    db.add(admin)
    db.flush()
    db.add(UserProfile(user_id=admin.id))
    db.add(RoleAssignment(user_id=admin.id, role_id="system_administrator", max_sensitivity="confidential"))
    db.commit()
    login = client.post("/api/v1/auth/login", json={"phone": admin.phone})
    assert login.status_code == 202
    limited = verify(client, login.json())
    assert limited["mfa_required"] and "access_token" not in limited
    enrollment = client.post("/api/v1/auth/mfa/enroll", json={"challenge_token": limited["mfa_challenge_token"]})
    assert enrollment.status_code == 200
    payload = {"challenge_token": limited["mfa_challenge_token"], "code": pyotp.TOTP(enrollment.json()["secret"]).now()}
    verified = client.post("/api/v1/auth/mfa/verify", json=payload)
    assert verified.status_code == 200, verified.text
    assert verified.json()["user"]["mfa_enabled"]
    assert client.post("/api/v1/auth/mfa/verify", json=payload).status_code == 401


def test_device_logout_revokes_access_and_refresh(client):
    _, challenge = register(client)
    tokens = verify(client, challenge)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_successful_registration_removes_duplicate_otp_personal_data(client, db):
    _, challenge = register(client)
    tokens = verify(client, challenge)
    assert db.get(OTPChallenge, challenge["challenge_id"]) is None
    replay = client.post("/api/v1/auth/verify-phone", json={
        "challenge_id": challenge["challenge_id"], "code": challenge["dev_otp"],
    })
    assert replay.status_code == 400
    assert tokens["user"]["full_name"] == "SINTETIK TEST"


def test_expired_challenge_cleanup_preserves_active_authentication(db, monkeypatch):
    from contextlib import contextmanager
    from app import worker

    @contextmanager
    def session():
        yield db

    monkeypatch.setattr(worker, "SessionLocal", session)
    expired = OTPChallenge(phone=phone(), purpose="register", code_hash="0" * 64,
        registration_data={"full_name": "EXPIRED PERSONAL DETAILS"}, expires_at=utcnow() - timedelta(seconds=1))
    active = OTPChallenge(phone=phone(), purpose="register", code_hash="0" * 64,
        registration_data={"full_name": "ACTIVE REGISTRATION"}, expires_at=utcnow() + timedelta(minutes=5))
    db.add_all([expired, active])
    db.commit()
    assert worker.expire_auth_challenges() >= 1
    assert db.get(OTPChallenge, expired.id) is None
    assert db.get(OTPChallenge, active.id) is not None
