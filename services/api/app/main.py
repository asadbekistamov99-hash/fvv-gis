"""HTTP application for the independent FVV GIS platform."""
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
import json
import logging
from pathlib import Path
import re
import time
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from starlette.middleware.cors import CORSMiddleware

from app.api import admin, approvals, auth, gis, infrastructure, inspections, notifications, reports, routes, sync, uploads
from app.core.config import settings
from app.db.session import engine, validate_runtime_roles

logger = logging.getLogger("fvv.api")
_limits: OrderedDict[str, deque] = OrderedDict()


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_roles()
    yield


app = FastAPI(
    title="FVV GIS Uzbekistan — independent platform",
    version="0.1.0",
    description="Independent proposed GIS platform. No government endorsement or official dispatch integration.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[value.strip() for value in settings.cors_origins.split(",") if value.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After"],
)


async def rate_limited(request: Request) -> bool:
    if settings.app_env == "test" or not request.url.path.startswith("/api/"):
        return False
    category = "auth" if request.url.path.startswith(("/api/v1/auth/login", "/api/v1/auth/register")) else "api"
    limit = 15 if category == "auth" else 600
    key = f"{request.client.host if request.client else 'unknown'}:{category}"
    if not settings.is_development:
        from redis.asyncio import Redis
        client = Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        try:
            bucket = f"rate:{key}:{int(time.time()) // 60}"
            async with client.pipeline(transaction=True) as pipeline:
                pipeline.incr(bucket)
                pipeline.expire(bucket, 120)
                count, _ = await pipeline.execute()
            return count > limit
        except Exception:
            raise HTTPException(503, "So‘rov cheklovi xizmati vaqtincha mavjud emas") from None
        finally:
            await client.aclose()
    now = time.monotonic()
    timestamps = _limits.setdefault(key, deque())
    _limits.move_to_end(key)
    while timestamps and timestamps[0] < now - 60:
        timestamps.popleft()
    if len(_limits) > 5000:
        _limits.popitem(last=False)
    if len(timestamps) >= limit:
        return True
    timestamps.append(now)
    return False


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = str(uuid4())
    request.state.request_id = request_id
    length = request.headers.get("content-length", "0")
    if length.isdigit() and int(length) > settings.upload_max_bytes + 1024 * 1024:
        return JSONResponse({"detail": "So‘rov hajmi juda katta", "request_id": request_id}, status_code=413)
    try:
        if await rate_limited(request):
            return JSONResponse({"detail": "So‘rovlar soni oshib ketdi", "request_id": request_id},
                                status_code=429, headers={"Retry-After": "60"})
    except HTTPException as exc:
        return JSONResponse({"detail": exc.detail, "request_id": request_id}, status_code=exc.status_code)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api/") and "/public/" not in request.url.path:
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    detail = exc.detail
    code = detail.get("code", f"HTTP_{exc.status_code}") if isinstance(detail, dict) else f"HTTP_{exc.status_code}"
    message = detail.get("message", "So‘rov bajarilmadi") if isinstance(detail, dict) else str(detail)
    return JSONResponse({"detail": detail, "error": {"code": code, "message": message},
                         "request_id": getattr(request.state, "request_id", None)},
                        status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Pydantic's raw errors include submitted values. Do not echo tokens or personal data.
    details = [{"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
    return JSONResponse({"detail": details, "error": {"code": "VALIDATION_ERROR", "message": "Maydonlarni tekshiring"},
                         "request_id": getattr(request.state, "request_id", None)}, status_code=422)


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, exc: IntegrityError):
    return JSONResponse({"detail": {"code": "CONSTRAINT_CONFLICT", "message": "Yozuv mavjud yoki bog‘langan ma’lumot noto‘g‘ri"},
                         "request_id": getattr(request.state, "request_id", None)}, status_code=409)


@app.exception_handler(Exception)
async def server_error(request: Request, exc: Exception):
    logger.error("request_failed request_id=%s error_type=%s", getattr(request.state, "request_id", None), type(exc).__name__)
    return JSONResponse({"detail": {"code": "SERVER_ERROR", "message": "Ichki xatolik. Keyinroq qayta urinib ko‘ring"},
                         "request_id": getattr(request.state, "request_id", None)}, status_code=500)


for module in (auth, infrastructure, gis, approvals, inspections, reports, uploads, notifications, sync, routes, admin):
    app.include_router(module.router, prefix="/api/v1")


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok", "application": "fvv-gis-uzbekistan"}


@app.get("/health/ready", include_in_schema=False)
def readiness():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1 FROM regions LIMIT 1"))
    except Exception:
        raise HTTPException(503, "Ma’lumotlar bazasi tayyor emas") from None
    return {"status": "ready"}


@app.get("/maps/style.json", include_in_schema=False)
@app.get("/tiles/style.json", include_in_schema=False)
def map_style(request: Request):
    path = settings.map_style_file or Path(__file__).resolve().parents[3] / "infrastructure/deployment/style.json"
    if not path.is_file():
        raise HTTPException(503, "Xarita uslubi sozlanmagan")
    style = json.loads(path.read_text())
    origin = str(request.base_url).rstrip("/")
    if isinstance(style.get("glyphs"), str) and style["glyphs"].startswith("/"):
        style["glyphs"] = origin + style["glyphs"]
    for source in style.get("sources", {}).values():
        if "tiles" in source:
            source["tiles"] = [origin + tile if tile.startswith("/") else tile for tile in source["tiles"]]
    return JSONResponse(style, headers={"Cache-Control": "public, max-age=300"})


@app.get("/tiles/{resource:path}", include_in_schema=False)
async def basemap_resource(resource: str):
    tile = re.fullmatch(r"uzbekistan/(\d{1,2})/(\d+)/(\d+)", resource)
    font = re.fullmatch(r"font/[A-Za-z0-9 ,_-]{1,160}/\d+-\d+\.pbf", resource)
    if not tile and not font:
        raise HTTPException(404, "Xarita resursi topilmadi")
    if tile:
        z, x, y = map(int, tile.groups())
        if not 0 <= z <= 18 or not 0 <= x < 2 ** z or not 0 <= y < 2 ** z:
            raise HTTPException(422, "Xarita plitkasi koordinatasi noto‘g‘ri")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            result = await client.get(f"{settings.tiles_upstream_url.rstrip('/')}/{resource}")
        if result.status_code == 404:
            return Response(status_code=204)
        result.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(503, "Xarita plitkalari xizmati mavjud emas") from None
    # httpx already decompresses gzip; do not forward its old Content-Encoding header.
    return Response(result.content, media_type="application/vnd.mapbox-vector-tile",
                    headers={"Cache-Control": "public, max-age=86400"})
