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


_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32)
    return "$".join(["scrypt", str(_SCRYPT_N), str(_SCRYPT_R), str(_SCRYPT_P),
                     base64.b64encode(salt).decode(), base64.b64encode(digest).decode()])


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        # Spend comparable time for unknown phones so responses do not reveal which accounts exist.
        hashlib.scrypt(password.encode(), salt=b"0" * 16, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32)
        return False
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt_b64), n=int(n), r=int(r),
                                p=int(p), dklen=len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


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
