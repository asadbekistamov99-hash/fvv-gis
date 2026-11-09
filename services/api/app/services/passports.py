"""Typed engineering validation and explicit pressure normalization."""
from __future__ import annotations

from datetime import date, datetime
import math
from typing import Annotated, Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

NonNegative = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Positive = Annotated[float, Field(gt=0, allow_inf_nan=False)]


class GeneralPassport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = Field(default=1, ge=1)
    installation_date: date | None = None
    installation_year: int | None = Field(default=None, ge=1850, le=2100)
    manufacturer: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    material: str | None = Field(default=None, max_length=100)
    technical_condition: str | None = Field(default=None, max_length=200)
    last_inspection_date: date | None = None
    next_inspection_date: date | None = None
    last_maintenance_date: date | None = None
    defect_description: str | None = Field(default=None, max_length=4000)
    repair_status: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=5000)
    extensions: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def dates_consistent(self):
        if self.last_inspection_date and self.next_inspection_date and self.next_inspection_date < self.last_inspection_date:
            raise ValueError("Keyingi tekshiruv sanasi oldingi tekshiruvdan avval bo‘lmaydi")
        return self


class HydrantPassport(GeneralPassport):
    hydrant_type: str | None = Field(default=None, max_length=100)
    installation_type: Literal["underground", "above_ground"] | None = None
    connected_pipeline_id: str | None = Field(default=None, max_length=100)
    connection_diameter_mm: Positive | None = None
    nominal_pressure_kpa: NonNegative | None = None
    measured_pressure_kpa: NonNegative | None = None
    measured_pressure: NonNegative | None = None
    pressure_unit: Literal["kPa", "bar", "atm"] = "kPa"
    flow_lps: NonNegative | None = None
    measurement_date: datetime | None = None
    measurement_method: str | None = Field(default=None, max_length=300)
    accessibility_status: str | None = Field(default=None, max_length=100)
    visible_condition: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def dated_measurements(self):
        if self.measured_pressure is not None and self.measured_pressure_kpa is not None:
            raise ValueError("Bosim uchun faqat bitta kirish qiymatini ko‘rsating")
        if any(v is not None for v in (self.measured_pressure_kpa, self.measured_pressure, self.flow_lps)) and self.measurement_date is None:
            raise ValueError("Bosim yoki sarf o‘lchovi sanasi majburiy")
        if self.measurement_date and self.measurement_date.tzinfo is None:
            raise ValueError("O‘lchov sanasida vaqt zonasi bo‘lishi kerak")
        return self


class WaterPassport(GeneralPassport):
    diameter_mm: Positive | None = None
    length_m: Positive | None = None
    depth_m: NonNegative | None = None
    pressure_kpa: NonNegative | None = None
    commissioning_date: date | None = None
    connections: list[str] = Field(default_factory=list, max_length=1000)
    capacity_m3: Positive | None = None
    pump_power_kw: Positive | None = None


class SewerPassport(GeneralPassport):
    diameter_mm: Positive | None = None
    depth_m: NonNegative | None = None
    length_m: Positive | None = None
    flow_type: Literal["gravity", "pressurized", "unknown"] | None = None
    connected_manholes: list[str] = Field(default_factory=list, max_length=1000)
    blockage_status: str | None = Field(default=None, max_length=500)
    reported_blockages: int | None = Field(default=None, ge=0)
    maintenance_condition: str | None = Field(default=None, max_length=120)


class GasPassport(GeneralPassport):
    diameter_mm: Positive | None = None
    pressure_kpa: NonNegative | None = None
    classification: str | None = Field(default=None, max_length=100)
    inspection_status: str | None = Field(default=None, max_length=100)


class ElectricalPassport(GeneralPassport):
    voltage_kv: Positive | None = None
    voltage_classification: str | None = Field(default=None, max_length=100)
    cable_type: str | None = Field(default=None, max_length=100)
    installation_method: str | None = Field(default=None, max_length=100)
    power_kva: Positive | None = None


def passport_type(category_id: str):
    key = category_id.replace("-", "_").lower()
    if "hydrant" in key:
        return HydrantPassport
    if "sewer" in key or "drain" in key:
        return SewerPassport
    if "gas" in key:
        return GasPassport
    if "electri" in key or "substation" in key:
        return ElectricalPassport
    if any(name in key for name in ("water", "pump", "reservoir", "pipeline")):
        return WaterPassport
    return GeneralPassport


def validate_passport(category_id: str, value: dict[str, Any], extension_schema: dict | None = None) -> dict:
    try:
        passport = passport_type(category_id).model_validate(value)
    except ValidationError as exc:
        errors = [{"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()]
        raise HTTPException(422, {"code": "INVALID_PASSPORT", "message": "Texnik pasport noto‘g‘ri", "fields": errors}) from exc
    definitions = (extension_schema or {}).get("extensions", {})
    for key, item in passport.extensions.items():
        spec = definitions.get(key)
        if not spec:
            raise HTTPException(422, f"Ro‘yxatdan o‘tmagan qo‘shimcha texnik maydon: {key}")
        kind = spec.get("type")
        if item is None:
            continue
        valid = ((kind == "string" and isinstance(item, str)) or
                 (kind == "number" and isinstance(item, (int, float)) and not isinstance(item, bool)) or
                 (kind == "integer" and isinstance(item, int) and not isinstance(item, bool)) or
                 (kind == "boolean" and isinstance(item, bool)))
        if not valid:
            raise HTTPException(422, f"Qo‘shimcha maydon turi noto‘g‘ri: {key}")
        if kind in {"number", "integer"} and not math.isfinite(item):
            raise HTTPException(422, f"Qo‘shimcha maydon chekli son bo‘lishi kerak: {key}")
        if kind == "string" and len(item) > spec.get("maxLength", 2000):
            raise HTTPException(422, f"Qo‘shimcha maydon juda uzun: {key}")
        if kind in {"number", "integer"} and (("minimum" in spec and item < spec["minimum"]) or ("maximum" in spec and item > spec["maximum"])):
            raise HTTPException(422, f"Qo‘shimcha maydon chegaradan tashqarida: {key}")
    result = passport.model_dump(mode="json")
    if isinstance(passport, HydrantPassport):
        if passport.measured_pressure is not None:
            factor = {"kPa": 1, "bar": 100, "atm": 101.325}[passport.pressure_unit]
            result["measured_pressure_kpa"] = passport.measured_pressure * factor
        result.pop("measured_pressure", None)
        result["pressure_unit"] = "kPa"
    return result
