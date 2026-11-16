"""Validate interchange geometry before it reaches PostGIS."""
from __future__ import annotations

import math
from typing import Any

from fastapi import HTTPException
from shapely.geometry import shape
from shapely.validation import explain_validity

GEOMETRY_TYPES = {"Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"}


def validate_geometry(value: dict[str, Any], allowed: list[str] | None = None) -> dict[str, Any]:
    if value.get("type") not in GEOMETRY_TYPES:
        raise HTTPException(422, "Qo‘llab-quvvatlanmaydigan geometriya turi")
    if allowed and value["type"] not in allowed:
        raise HTTPException(422, "Geometriya ushbu kategoriya uchun mos emas")

    def coordinates(node: Any) -> None:
        if not isinstance(node, list) or not node:
            raise HTTPException(422, "Koordinatalar bo‘sh bo‘lmasligi kerak")
        if isinstance(node[0], (int, float)):
            if len(node) != 2 or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in node):
                raise HTTPException(422, "WGS84 koordinatasi ikkita chekli son bo‘lishi kerak")
            if not -180 <= node[0] <= 180 or not -90 <= node[1] <= 90:
                raise HTTPException(422, "WGS84 koordinatasi chegaradan tashqarida")
        else:
            for item in node:
                coordinates(item)

    coordinates(value.get("coordinates"))
    try:
        geom = shape(value)
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(422, "Geometriya noto‘g‘ri") from exc
    if geom.is_empty or not geom.is_valid:
        raise HTTPException(422, f"Geometriya noto‘g‘ri: {explain_validity(geom)}")
    if geom.geom_type in {"LineString", "MultiLineString"} and geom.length == 0:
        raise HTTPException(422, "Chiziq uzunligi noldan katta bo‘lishi kerak")
    if geom.geom_type == "MultiLineString":
        # Segment endpoints must form one connected network; a crossing is not a declared connection.
        segments = list(geom.geoms)
        connected = {0}
        while True:
            found = {
                i for i, line in enumerate(segments) if i not in connected
                and any(set(map(tuple, (line.coords[0], line.coords[-1]))) &
                        set(map(tuple, (segments[j].coords[0], segments[j].coords[-1]))) for j in connected)
            }
            if not found:
                break
            connected |= found
        if len(connected) != len(segments):
            raise HTTPException(422, "Quvur segmentlari uchlari orqali o‘zaro ulanishi kerak")
    return {"type": value["type"], "coordinates": value["coordinates"]}


def parse_bbox(value: str | None) -> tuple[float, float, float, float] | None:
    if not value:
        return None
    try:
        result = tuple(float(part) for part in value.split(","))
        if len(result) != 4 or not all(math.isfinite(v) for v in result):
            raise ValueError
        west, south, east, north = result
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
            raise ValueError
        return result
    except ValueError as exc:
        raise HTTPException(422, "bbox g‘arb,janub,sharq,shimol shaklida bo‘lishi kerak") from exc
