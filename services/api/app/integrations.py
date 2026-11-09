"""Connected providers. Development authentication never calls these functions."""

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from threading import Lock

import httpx
from fastapi import HTTPException

from app.core.config import settings

_sms_lock = Lock()
_sms_token: str | None = None
_sms_token_until = datetime.min.replace(tzinfo=timezone.utc)


def _eskiz_token(*, force: bool = False) -> str:
    global _sms_token, _sms_token_until
    with _sms_lock:
        now = datetime.now(timezone.utc)
        if not force and _sms_token and now < _sms_token_until:
            return _sms_token
        response = httpx.post(
            f"{settings.eskiz_base_url.rstrip('/')}/auth/login",
            data={"email": settings.eskiz_email, "password": settings.eskiz_password},
            timeout=15,
        )
        response.raise_for_status()
        _sms_token = response.json()["data"]["token"]
        # Refresh conservatively rather than trusting a provider's undocumented expiry.
        _sms_token_until = now + timedelta(minutes=30)
        return _sms_token


def send_otp_sms(phone: str, code: str) -> None:
    """Send only the phone number and OTP text to the configured SMS provider."""
    if (
        settings.sms_provider != "eskiz"
        or not settings.live_intake_enabled
        or not settings.live_policy_ready
        or not settings.eskiz_email
        or not settings.eskiz_password
    ):
        raise HTTPException(503, "SMS xizmati va operator siyosati sozlanmagan")
    try:
        token = _eskiz_token()
        for attempt in range(2):
            response = httpx.post(
                f"{settings.eskiz_base_url.rstrip('/')}/message/sms/send",
                headers={"Authorization": f"Bearer {token}"},
                data={
                    "mobile_phone": phone.lstrip("+"),
                    "message": f"FVV GIS tasdiqlash kodi: {code}. Kodni hech kimga bermang.",
                    "from": settings.eskiz_sender,
                },
                timeout=15,
            )
            if response.status_code == 401 and attempt == 0:
                token = _eskiz_token(force=True)
                continue
            response.raise_for_status()
            return
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        # Never relay provider bodies, which can contain phone numbers or credentials.
        raise HTTPException(503, "SMS yuborilmadi. Keyinroq qayta urinib ko‘ring") from None
    raise HTTPException(503, "SMS xizmati vaqtincha mavjud emas")


@lru_cache(maxsize=1)
def _firebase_credentials():
    from google.oauth2 import service_account

    if not settings.firebase_credentials_path:
        raise RuntimeError("Firebase credentials are not configured")
    return service_account.Credentials.from_service_account_file(
        settings.firebase_credentials_path,
        scopes=["https://www.googleapis.com/auth/firebase.messaging"],
    )


def send_push_message(
    token: str,
    notification_id: str,
    *,
    public_title: str | None = None,
    public_body: str | None = None,
) -> bool:
    """Return False for a permanently invalid token; transient failures remain retryable."""
    from google.auth.transport.requests import Request

    credentials = _firebase_credentials()
    if not credentials.valid:
        credentials.refresh(Request())
    message = {
        "token": token,
        "notification": {
            "title": public_title or "Yangi bildirishnoma",
            "body": public_body or "Tafsilotlarni ilovada ko‘ring.",
        },
        "data": {"notification_id": notification_id},
        "android": {"priority": "normal", "ttl": "3600s"},
    }
    with httpx.Client(timeout=20) as client:
        response = client.post(
            f"https://fcm.googleapis.com/v1/projects/{credentials.project_id}/messages:send",
            headers={"Authorization": f"Bearer {credentials.token}"},
            json={"message": message},
        )
    if response.status_code in {400, 404}:
        try:
            details = response.json().get("error", {}).get("details", [])
            if any(detail.get("errorCode") == "UNREGISTERED" for detail in details):
                return False
        except (ValueError, TypeError):
            pass
    if response.is_error:
        raise RuntimeError(f"Push provider failed with HTTP {response.status_code}")
    return True
