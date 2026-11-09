import base64
import hashlib
import hmac
import secrets
from datetime import timedelta

from cryptography.fernet import Fernet
import jwt

from app.core.config import settings
from app.db.base import utcnow


def hash_secret(value: str) -> str:
    return hmac.new(settings.secret_key.encode(), value.encode(), hashlib.sha256).hexdigest()


def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def random_token() -> str:
    return secrets.token_urlsafe(48)


def encode_token(claims: dict, *, minutes: int = 5, purpose: str = "access") -> str:
    now = utcnow()
    return jwt.encode({**claims, "iat": now, "exp": now + timedelta(minutes=minutes),
                       "iss": "fvv-gis-independent", "aud": "fvv-gis", "purpose": purpose},
                      settings.secret_key, algorithm="HS256")


def decode_token(token: str, *, purpose: str = "access") -> dict:
    claims = jwt.decode(token, settings.secret_key, algorithms=["HS256"],
                        issuer="fvv-gis-independent", audience="fvv-gis",
                        options={"require": ["exp", "iat", "sub", "purpose"]})
    if claims.get("purpose") != purpose:
        raise jwt.InvalidTokenError("Incorrect token purpose")
    return claims


def encrypt_secret(value: str) -> str:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key).encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key).decrypt(value.encode()).decode()
