from typing import Literal

import phonenumbers
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class PhoneRequest(BaseModel):
    phone: str
    device_id: str = Field(default="unknown", max_length=200)

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str) -> str:
        try:
            parsed = phonenumbers.parse(value, "UZ")
        except phonenumbers.NumberParseException as exc:
            raise ValueError("Telefon raqami noto‘g‘ri") from exc
        if parsed.country_code != 998 or not phonenumbers.is_valid_number(parsed):
            raise ValueError("O‘zbekiston telefon raqamini kiriting")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


class PasswordLoginRequest(PhoneRequest):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(PhoneRequest):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=200)
    account_type: Literal["citizen", "employee"] = Field(default="citizen", validation_alias=AliasChoices("account_type", "registration_type", "user_type"))
    organization_id: str | None = None
    organization_name: str = Field(default="", max_length=200)
    department: str = Field(default="", max_length=200)
    region_id: str | None = None
    district_id: str | None = None
    verification_reference: str | None = Field(default=None, max_length=200)
    requested_role: str = Field(default="verified_employee", max_length=40)
    is_synthetic: bool = False

    @field_validator("password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        if not any(ch.isalpha() for ch in value) or not any(ch.isdigit() for ch in value):
            raise ValueError("Parolda kamida bitta harf va bitta raqam bo‘lsin")
        return value


class VerifyRequest(BaseModel):
    challenge_id: str
    code: str = Field(pattern=r"^\d{6}$")
    device_id: str = Field(default="unknown", max_length=200)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=500)


class MFAEnrollRequest(BaseModel):
    challenge_token: str


class MFAVerifyRequest(MFAEnrollRequest):
    code: str = Field(pattern=r"^\d{6}$")
    device_id: str = Field(default="unknown", max_length=200)


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    language: Literal["uz", "ru", "en"] | None = None
    notification_preferences: dict[str, bool] | None = None
