from types import SimpleNamespace

from app.main import client_address


def request(headers=None, host="10.0.0.5"):
    return SimpleNamespace(headers=headers or {}, client=SimpleNamespace(host=host))


def test_uses_socket_address_outside_vercel(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    assert client_address(request({"x-real-ip": "203.0.113.9"})) == "10.0.0.5"


def test_uses_vercel_edge_address_on_vercel(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    assert client_address(request({"x-real-ip": "203.0.113.9"})) == "203.0.113.9"


def test_falls_back_when_vercel_header_missing(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    assert client_address(request()) == "10.0.0.5"


def test_hosted_postgres_urls_use_the_psycopg_driver():
    from app.core.config import Settings
    settings = Settings(database_url="postgres://u:p@host/db?sslmode=require",
                        public_database_url="postgresql://r:p@host/db")
    assert settings.database_url == "postgresql+psycopg://u:p@host/db?sslmode=require"
    assert settings.public_database_url == "postgresql+psycopg://r:p@host/db"
    assert Settings(database_url="postgresql+psycopg://u:p@h/d").database_url == "postgresql+psycopg://u:p@h/d"
