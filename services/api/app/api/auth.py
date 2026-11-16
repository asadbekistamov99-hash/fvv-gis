from datetime import timedelta
import hmac
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
import pyotp
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.policy import ADMIN_ROLES, effective_roles
from app.core.security import decode_token, decrypt_secret, encode_token, encrypt_secret, hash_password, hash_secret, random_token, token_hash, verify_password
from app.db.base import new_id, utcnow
from app.db.session import get_db
from app.models import AuditLog, AuthSession, DeviceRegistration, District, EmployeeVerification, Notification, OTPChallenge, Organization, RefreshToken, Region, RolePermission, User, UserProfile
from app.schemas.auth import MFAEnrollRequest, MFAVerifyRequest, PasswordLoginRequest, PhoneRequest, ProfileUpdate, RefreshRequest, RegisterRequest, VerifyRequest

router = APIRouter(tags=["Authentication"])
bearer = HTTPBearer(auto_error=False)


def error(status: int, code: str, message: str):
    return HTTPException(status, detail={"code": code, "message": message})


def audit(db, action, user_id=None, target_id=None, outcome="success", details=None):
    db.add(AuditLog(actor_id=user_id, action=action, target_type="authentication", target_id=target_id,
                    outcome=outcome, details=details or {}))


def serialize_user(db: Session, user: User) -> dict:
    profile = db.get(UserProfile, user.id)
    roles = effective_roles(db, user)
    permissions = sorted(set(db.scalars(select(RolePermission.permission_id).where(RolePermission.role_id.in_(roles)))))
    return {"id": user.id, "phone": user.phone, "full_name": user.full_name, "role": user.role,
            "roles": sorted(roles), "permissions": permissions, "employee_status": user.employee_status,
            "organization_id": user.organization_id, "region_id": user.region_id, "district_id": user.district_id,
            "is_active": user.is_active, "is_synthetic": user.is_synthetic, "policy_epoch": user.policy_epoch,
            "mfa_enabled": user.mfa_enabled, "language": profile.language if profile else "uz",
            "notification_preferences": profile.notification_preferences if profile else {},
            "created_at": user.created_at.isoformat()}


def intake_allowed(is_synthetic: bool):
    if is_synthetic and settings.is_development and settings.allow_synthetic_registration:
        return
    if not (settings.live_intake_enabled and settings.live_policy_ready):
        raise error(503, "live_intake_disabled", "Haqiqiy ma’lumot qabul qilish operator siyosati tasdiqlanguncha yopiq")


def create_challenge(db: Session, phone: str, purpose: str, data: dict | None = None):
    now = utcnow()
    recent = db.scalar(select(OTPChallenge).where(OTPChallenge.phone == phone).order_by(OTPChallenge.created_at.desc()).limit(1))
    if recent and (now - recent.created_at).total_seconds() < settings.otp_resend_seconds:
        raise error(429, "otp_rate_limited", "Yangi kod so‘rashdan oldin biroz kuting")
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = OTPChallenge(id=new_id(), phone=phone, purpose=purpose, code_hash="", registration_data=data or {},
                             expires_at=now + timedelta(seconds=settings.otp_ttl_seconds))
    challenge.code_hash = hash_secret(f"{challenge.id}:{code}")
    db.add(challenge)
    db.flush()
    development_delivery = settings.is_development and settings.dev_otp_enabled and settings.sms_provider == "development"
    if development_delivery:
        response = {"challenge_id": challenge.id, "expires_in": settings.otp_ttl_seconds, "dev_otp": code,
                    "delivery": "development_only"}
    else:
        if settings.sms_provider != "eskiz":
            db.rollback()
            raise error(503, "sms_unavailable", "SMS xizmati sozlanmagan")
        from app.integrations import send_otp_sms
        try:
            send_otp_sms(phone, code)
        except Exception:
            db.rollback()
            raise error(503, "sms_unavailable", "Tasdiqlash kodini yuborib bo‘lmadi") from None
        response = {"challenge_id": challenge.id, "expires_in": settings.otp_ttl_seconds, "delivery": "sms"}
    audit(db, "auth.otp_requested", details={"purpose": purpose})
    db.commit()
    return response


@router.post("/auth/register", status_code=202)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    intake_allowed(payload.is_synthetic)
    if db.scalar(select(User.id).where(User.phone == payload.phone)):
        raise error(409, "phone_registered", "Bu raqam ro‘yxatdan o‘tgan")
    if payload.account_type == "employee":
        if not payload.region_id or not db.get(Region, payload.region_id) or not payload.department.strip():
            raise error(422, "employee_details_required", "Hudud va bo‘limni to‘ldiring")
        if not payload.organization_id and not payload.organization_name.strip():
            raise error(422, "organization_required", "Tashkilotni kiriting")
        if payload.organization_id and not db.get(Organization, payload.organization_id):
            raise error(422, "invalid_organization", "Tashkilot topilmadi")
        if payload.district_id:
            district = db.get(District, payload.district_id)
            if not district or district.region_id != payload.region_id:
                raise error(422, "invalid_district", "Tuman hududga mos emas")
    data = payload.model_dump(exclude={"password"})
    data["password_hash"] = hash_password(payload.password)
    return create_challenge(db, payload.phone, "register", data)


@router.post("/auth/login/password")
def login_with_password(payload: PasswordLoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.phone == payload.phone))
    password_ok = verify_password(payload.password, user.password_hash if user else None)
    if not user or not password_ok or not user.is_active or user.deleted_at:
        audit(db, "auth.password_failed", user.id if user else None, outcome="denied")
        db.commit()
        raise error(401, "invalid_credentials", "Telefon yoki parol noto‘g‘ri")
    intake_allowed(user.is_synthetic)
    if user.role in ADMIN_ROLES or user.mfa_enabled:
        # Privileged accounts keep the SMS code plus MFA path; a password alone never grants them access.
        raise error(403, "otp_required", "Ushbu hisob uchun SMS kod orqali kiring")
    result = issue_session(db, user, payload.device_id)
    audit(db, "auth.login_password", user.id)
    db.commit()
    return result


@router.post("/auth/login", status_code=202)
def login(payload: PhoneRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.phone == payload.phone))
    if user:
        intake_allowed(user.is_synthetic)
    else:
        intake_allowed(False)
    return create_challenge(db, payload.phone, "login")


def issue_session(db: Session, user: User, device_id="unknown", mfa_verified=False, session=None):
    if session is None:
        session = AuthSession(user_id=user.id, device_id=device_id, mfa_verified=mfa_verified,
                              expires_at=utcnow() + timedelta(days=settings.refresh_token_days))
        db.add(session)
        db.flush()
    raw_refresh = random_token()
    db.add(RefreshToken(session_id=session.id, token_hash=token_hash(raw_refresh), expires_at=session.expires_at))
    access = encode_token({"sub": user.id, "sid": session.id, "epoch": user.policy_epoch},
                          minutes=settings.access_token_minutes)
    return {"access_token": access, "refresh_token": raw_refresh, "token_type": "bearer",
            "expires_in": settings.access_token_minutes * 60, "user": serialize_user(db, user)}


@router.post("/auth/verify-phone")
def verify_phone(payload: VerifyRequest, db: Session = Depends(get_db)):
    challenge = db.scalar(select(OTPChallenge).where(OTPChallenge.id == payload.challenge_id).with_for_update())
    if not challenge or challenge.consumed_at or challenge.expires_at <= utcnow() or challenge.attempts >= settings.otp_max_attempts:
        raise error(400, "invalid_otp", "Kod yaroqsiz yoki muddati tugagan")
    challenge.attempts += 1
    if not hmac.compare_digest(challenge.code_hash, hash_secret(f"{challenge.id}:{payload.code}")):
        audit(db, "auth.otp_failed", outcome="denied")
        db.commit()
        raise error(400, "invalid_otp", "Kod yaroqsiz yoki muddati tugagan")
    user = db.scalar(select(User).where(User.phone == challenge.phone))
    if challenge.purpose == "register":
        if user:
            raise error(409, "phone_registered", "Bu raqam ro‘yxatdan o‘tgan")
        data = challenge.registration_data
        intake_allowed(data.get("is_synthetic", False))
        employee = data.get("account_type") == "employee"
        user = User(phone=challenge.phone, full_name=data["full_name"],
                    role="pending_employee" if employee else "citizen",
                    employee_status="pending_verification" if employee else "none",
                    organization_id=data.get("organization_id"), region_id=data.get("region_id"),
                    district_id=data.get("district_id"), is_synthetic=data.get("is_synthetic", False),
                    phone_verified_at=utcnow(), password_hash=data.get("password_hash"))
        db.add(user)
        db.flush()
        db.add(UserProfile(user_id=user.id, department=data.get("department")))
        if employee:
            db.add(EmployeeVerification(user_id=user.id, full_name=data["full_name"], organization_id=data.get("organization_id"),
                                        organization_name=data.get("organization_name", ""), department=data.get("department", ""),
                                        region_id=data["region_id"], district_id=data.get("district_id"),
                                        verification_reference=data.get("verification_reference"),
                                        requested_role=data.get("requested_role", "verified_employee")))
    if not user or not user.is_active or user.deleted_at:
        db.delete(challenge)
        db.commit()
        raise error(401, "invalid_account", "Hisob mavjud emas yoki kirish to‘xtatilgan")
    intake_allowed(user.is_synthetic)
    challenge.consumed_at = utcnow()
    challenge.registration_data = {}
    if user.role in ADMIN_ROLES or user.mfa_enabled or challenge.purpose == "mfa_setup":
        # The second factor has its own five-minute window after successful OTP.
        challenge.expires_at = utcnow() + timedelta(minutes=5)
        token = encode_token({"sub": user.id, "challenge": challenge.id}, purpose="mfa", minutes=5)
        audit(db, "auth.mfa_requested", user.id)
        db.commit()
        return {"mfa_required": True, "mfa_setup_required": not user.mfa_enabled, "mfa_challenge_token": token}
    result = issue_session(db, user, payload.device_id)
    db.delete(challenge)
    audit(db, "auth.login", user.id)
    db.commit()
    return result


def mfa_user(db, token):
    try:
        claims = decode_token(token, purpose="mfa")
    except jwt.InvalidTokenError:
        raise error(401, "invalid_mfa_challenge", "Tasdiqlash muddati tugagan") from None
    user = db.get(User, claims["sub"])
    if not user or not user.is_active:
        raise error(401, "invalid_mfa_challenge", "Hisobga kirish yopilgan")
    challenge = db.scalar(select(OTPChallenge).where(OTPChallenge.id == claims.get("challenge")).with_for_update())
    if not challenge or not challenge.consumed_at or challenge.attempts >= settings.otp_max_attempts + 5:
        raise error(401, "invalid_mfa_challenge", "Tasdiqlash muddati tugagan")
    return user, challenge


@router.post("/auth/mfa/enroll")
def mfa_enroll(payload: MFAEnrollRequest, db: Session = Depends(get_db)):
    user, challenge = mfa_user(db, payload.challenge_token)
    if user.mfa_enabled:
        raise error(409, "mfa_already_enabled", "Ikki bosqichli himoya yoqilgan")
    if not user.mfa_secret:
        user.mfa_secret = encrypt_secret(pyotp.random_base32())
    secret = decrypt_secret(user.mfa_secret)
    audit(db, "auth.mfa_enrollment_started", user.id)
    db.commit()
    return {"secret": secret, "provisioning_uri": pyotp.TOTP(secret).provisioning_uri(user.phone, issuer_name="FVV GIS Independent")}


@router.post("/auth/mfa/verify")
def mfa_verify(payload: MFAVerifyRequest, db: Session = Depends(get_db)):
    user, challenge = mfa_user(db, payload.challenge_token)
    challenge.attempts += 1
    if not user.mfa_secret or not pyotp.TOTP(decrypt_secret(user.mfa_secret)).verify(payload.code, valid_window=1):
        audit(db, "auth.mfa_failed", user.id, outcome="denied")
        db.commit()
        raise error(400, "invalid_mfa", "Tasdiqlash kodi noto‘g‘ri")
    # Mark this OTP-backed MFA exchange spent to reject replay of its limited challenge token.
    challenge.attempts = settings.otp_max_attempts + 5
    user.mfa_enabled = True
    result = issue_session(db, user, payload.device_id, mfa_verified=True)
    db.delete(challenge)
    audit(db, "auth.mfa_login", user.id)
    db.commit()
    return result


def optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    if credentials is None:
        return None
    try:
        claims = decode_token(credentials.credentials)
    except jwt.InvalidTokenError:
        raise error(401, "invalid_token", "Qayta tizimga kiring") from None
    user = db.get(User, claims["sub"])
    session = db.get(AuthSession, claims.get("sid"))
    if not user or not session or session.user_id != user.id or not user.is_active or user.deleted_at or session.revoked_at or session.expires_at <= utcnow():
        raise error(401, "session_revoked", "Sessiya bekor qilingan")
    if claims.get("epoch") != user.policy_epoch:
        raise error(401, "policy_changed", "Ruxsatlar o‘zgardi; sessiyani yangilang")
    if (user.role in ADMIN_ROLES or user.mfa_enabled) and not session.mfa_verified:
        raise error(403, "mfa_required", "Ikki bosqichli tasdiqlash kerak")
    return user


def get_current_user(user: User | None = Depends(optional_user)) -> User:
    if not user:
        raise error(401, "authentication_required", "Tizimga kiring")
    return user


@router.post("/auth/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    old = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash(payload.refresh_token)).with_for_update())
    if not old:
        raise error(401, "invalid_refresh", "Qayta tizimga kiring")
    session = db.get(AuthSession, old.session_id)
    user = db.get(User, session.user_id) if session else None
    if old.used_at:
        if session:
            session.revoked_at = utcnow()
            audit(db, "auth.refresh_reuse", session.user_id, session.id, outcome="denied")
        db.commit()
        raise error(401, "refresh_reuse", "Sessiya xavfsizlik sababli bekor qilindi")
    if not session or session.revoked_at or old.expires_at <= utcnow() or not user or not user.is_active or user.deleted_at:
        raise error(401, "session_revoked", "Sessiya bekor qilingan")
    if (user.role in ADMIN_ROLES or user.mfa_enabled) and not session.mfa_verified:
        session.revoked_at = utcnow()
        db.commit()
        raise error(401, "mfa_required", "Ikki bosqichli tasdiqlash bilan qayta kiring")
    old.used_at = utcnow()
    result = issue_session(db, user, session=session)
    db.commit()
    return result


@router.post("/auth/logout")
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    claims = decode_token(request.headers["authorization"].split(" ", 1)[1])
    session = db.get(AuthSession, claims["sid"])
    session.revoked_at = utcnow()
    for device in db.scalars(select(DeviceRegistration).where(DeviceRegistration.user_id == user.id,
                                                               DeviceRegistration.device_id == session.device_id)).all():
        device.revoked_at = utcnow()
    audit(db, "auth.logout", user.id, session.id)
    db.commit()
    return {"status": "logged_out"}


@router.get("/users/me", tags=["Profile"])
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize_user(db, user)


@router.patch("/users/me", tags=["Profile"])
def update_me(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.get(UserProfile, user.id)
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.language is not None:
        profile.language = payload.language
    if payload.notification_preferences is not None:
        profile.notification_preferences = payload.notification_preferences
    audit(db, "profile.updated", user.id, user.id)
    db.commit()
    return serialize_user(db, user)


@router.delete("/users/me", tags=["Profile"])
def delete_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(delete(OTPChallenge).where(OTPChallenge.phone == user.phone))
    user.is_active = False
    user.deleted_at = utcnow()
    user.phone = f"deleted:{user.id}"
    user.full_name = "O‘chirilgan hisob"
    user.mfa_secret = None
    user.policy_epoch += 1
    for session in db.scalars(select(AuthSession).where(AuthSession.user_id == user.id)).all():
        session.revoked_at = utcnow()
    for device in db.scalars(select(DeviceRegistration).where(DeviceRegistration.user_id == user.id)).all():
        device.revoked_at = utcnow()
        device.push_token = "revoked"
    profile = db.get(UserProfile, user.id)
    if profile:
        db.delete(profile)
    audit(db, "account.deleted", user.id, user.id, details={"retention_policy": settings.retention_policy_reference or "synthetic_development"})
    db.commit()
    return {"status": "deleted", "retention_policy": settings.retention_policy_reference or "synthetic_development"}


@router.get("/auth/sessions")
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))).all()
    return {"items": [{"id": s.id, "device_id": s.device_id, "created_at": s.created_at.isoformat(),
                        "expires_at": s.expires_at.isoformat()} for s in rows], "total": len(rows)}


@router.delete("/auth/sessions/{session_id}")
def revoke_session(session_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.get(AuthSession, session_id)
    if not session or session.user_id != user.id:
        raise error(404, "not_found", "Sessiya topilmadi")
    session.revoked_at = utcnow()
    audit(db, "auth.session_revoked", user.id, session.id)
    db.commit()
    return {"status": "revoked"}


@router.post("/auth/mfa/setup")
def start_optional_mfa(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.mfa_enabled:
        raise error(409, "mfa_already_enabled", "Ikki bosqichli himoya yoqilgan")
    return create_challenge(db, user.phone, "mfa_setup")
