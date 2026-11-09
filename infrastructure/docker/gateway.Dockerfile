# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS web
WORKDIR /src
COPY apps/admin-web/package*.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY apps/admin-web/ ./
RUN npm run build
FROM caddy:2.11.9-alpine
COPY --from=web /src/dist /srv/admin
COPY infrastructure/deployment/Caddyfile /etc/caddy/Caddyfile
COPY infrastructure/deployment/style.json /srv/map/style.json
