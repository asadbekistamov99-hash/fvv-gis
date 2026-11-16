from functools import lru_cache
from pathlib import Path
import secrets

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False, env_ignore_empty=True)

    app_env: str = "development"
    database_url: str = "postgresql+psycopg://fvv:fvv@localhost:5432/fvv"
    public_database_url: str = ""
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = secrets.token_urlsafe(48)
    access_token_minutes: int = 5
    refresh_token_days: int = 30
    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5
    otp_resend_seconds: int = 60
    dev_otp_enabled: bool = False
    allow_synthetic_registration: bool = True
    registration_organization_ids: str = ""
    sms_provider: str = "development"
    eskiz_email: str = ""
    eskiz_password: str = ""
    eskiz_sender: str = "4546"
    eskiz_base_url: str = "https://notify.eskiz.uz/api"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    operator_name: str = ""
    operator_contact: str = ""
    responsible_team: str = ""
    retention_policy_reference: str = ""
    retention_policy_approved: bool = False
    report_retention_days: int | None = None
    audit_retention_days: int | None = None
    backup_retention_days: int | None = None
    live_intake_enabled: bool = False
    offline_lease_hours: int = 8
    storage_backend: str = "local"
    upload_directory: Path = Path("var/uploads")
    upload_max_bytes: int = 20 * 1024 * 1024
    s3_endpoint_url: str = "http://localhost:8333"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "fvv-private"
    clamav_host: str = ""
    clamav_port: int = 3310
    firebase_credentials_path: str = ""
    osrm_url: str = "http://localhost:5001"
    osrm_source_date: str = "unknown"
    map_style_url: str = "/maps/style.json"
    map_style_file: Path | None = None
    tiles_upstream_url: str = "http://127.0.0.1:3000"
    public_base_url: str = "http://localhost:8000"

    @property
    def is_development(self) -> bool:
        return self.app_env in {"development", "test"}

    @property
    def live_policy_ready(self) -> bool:
        return bool(
            self.retention_policy_approved and self.retention_policy_reference
            and self.operator_name and self.operator_contact and self.responsible_team
            and all(v is not None and v > 0 for v in (
                self.report_retention_days, self.audit_retention_days, self.backup_retention_days
            ))
        )

    @model_validator(mode="after")
    def check_security(self):
        if not self.is_development:
            if not self.public_database_url or self.public_database_url == self.database_url:
                raise ValueError("Production requires a separate restricted PUBLIC_DATABASE_URL")
            if "secret_key" not in self.model_fields_set or len(self.secret_key) < 40:
                raise ValueError("Production SECRET_KEY must contain at least 40 characters")
            if self.dev_otp_enabled or self.sms_provider == "development":
                raise ValueError("Development OTP is forbidden outside development/test")
            if self.storage_backend == "local":
                raise ValueError("Production requires private S3-compatible object storage")
            if not self.s3_access_key or not self.s3_secret_key:
                raise ValueError("Production requires private object-storage credentials")
        if self.live_intake_enabled and not self.live_policy_ready:
            raise ValueError("Live intake requires approved operator, retention and responsible-team settings")
        if self.live_intake_enabled and (self.sms_provider != "eskiz" or not self.eskiz_email or not self.eskiz_password):
            raise ValueError("Live intake requires configured Eskiz credentials")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
