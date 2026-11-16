"""Integration fixtures use a real PostgreSQL/PostGIS transaction per test."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import engine, get_db, get_public_db


@pytest.fixture
def db():
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint")
        try:
            from app.seed import seed_catalog
            seed_catalog(session)
            session.commit()
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture
def client(db, monkeypatch):
    from app.main import app
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "dev_otp_enabled", True)
    monkeypatch.setattr(settings, "sms_provider", "development")
    monkeypatch.setattr(settings, "allow_synthetic_registration", True)
    monkeypatch.setattr(settings, "otp_resend_seconds", 0)
    monkeypatch.setattr(settings, "live_intake_enabled", False)

    def override_db():
        yield db

    # Public HTTP acceptance tests still use actual PostgreSQL; dedicated DB-role isolation
    # is additionally verified with direct SET ROLE tests, since this transaction holds fixtures.
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_public_db] = override_db
    with TestClient(app) as http:
        yield http
    app.dependency_overrides.clear()
