# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
COPY services/api/pyproject.toml services/api/uv.lock /app/
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export PIP_CERT=/run/secrets/proxy_ca SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    pip install --no-cache-dir uv==0.13.5 && uv sync --frozen --no-dev --no-install-project
COPY services/api/app /app/app
COPY services/api/alembic /app/alembic
COPY services/api/alembic.ini /app/alembic.ini
COPY infrastructure/deployment/style.json /app/map/style.json
ENV MAP_STYLE_FILE=/app/map/style.json
RUN useradd --uid 10001 --create-home app && mkdir -p /app/uploads /app/retention-ledger && chown app:app /app/uploads /app/retention-ledger
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--proxy-headers", "--forwarded-allow-ips", "*"]
