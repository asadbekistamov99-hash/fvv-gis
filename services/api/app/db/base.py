from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import DeclarativeBase


def new_id() -> str:
    return str(uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass
