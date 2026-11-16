from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
public_engine = create_engine(settings.public_database_url, pool_pre_ping=True) if settings.public_database_url else engine
PublicSessionLocal = sessionmaker(bind=public_engine, expire_on_commit=False, autoflush=False)


def get_db():
    with SessionLocal() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise


def get_public_db():
    with PublicSessionLocal() as session:
        if not settings.public_database_url:
            # Development uses the same local connection but switches to a read-only database role.
            session.execute(text("SET LOCAL ROLE fvv_public"))
        yield session


def validate_runtime_roles():
    if settings.is_development:
        return
    with engine.connect() as conn:
        unsafe = conn.scalar(text("SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname=current_user"))
        owner = conn.scalar(text("SELECT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='audit_logs' AND tableowner=current_user)"))
        if unsafe or owner:
            raise RuntimeError("Application database role must not own tables or have role-administration privileges")
    with public_engine.connect() as conn:
        private_access = conn.scalar(text("SELECT has_table_privilege(current_user,'infrastructure_objects','SELECT')"))
        if private_access:
            raise RuntimeError("Public GIS database role must not read restricted infrastructure tables")
