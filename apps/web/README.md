# FVV GIS web

The single web front end for the platform: a public map for visitors, a citizen portal, and the operational workspace for verified employees and administrators. React + TypeScript + Vite + Tailwind + TanStack Query + MapLibre GL JS. Uzbek Latin is the default, with Russian/English and light/dark themes.

```sh
npm ci
npm run dev
npm run build
npm test
```

Vite proxies `/api` to FastAPI on `127.0.0.1:8000`. Configure `API_PROXY_TARGET` for another local API. `VITE_API_URL` is compiled into the bundle and must never contain credentials. `VITE_MAP_STYLE_URL` defaults to `/tiles/style.json`; configure a licensed self-hosted MapLibre style. A missing basemap is visibly identified and objects are still loaded from the API. No public third-party basemap is silently substituted.

## Areas

- **Visitors (no sign-in):** public map from `/public/gis/objects` with region, category and status filters, and the 112 notice.
- **Citizens:** non-emergency report form with optional location and attachment, own report tracking, notifications, profile, sessions and account deletion. Pending employee applicants see the same portal plus their application status.
- **Employees and administrators:** scope-filtered registry and map, technical passports, geometry drawing, draft/submission workflow, approval/rejection/publication, employee verification, report assignment, inspections, routes, notifications, category schemas, audit and backup status.

Source layout: `src/App.tsx` holds the shell, sign-in and operational views; `src/Portal.tsx` holds the public map and citizen portal.

## Authentication

Sign-in works by SMS code, by phone and password, or through registration. A development OTP is displayed only when the backend explicitly returns `dev_otp`. Until the operator enables live intake (`/public/config`), registrations and reports are sent as clearly marked synthetic records. Administrators enroll and verify TOTP through backend MFA endpoints and cannot use password sign-in. Access and refresh tokens are held in memory only, so reloading requires a new sign-in. Language and theme are the only settings persisted in localStorage. API responses are never replaced with mock records when the backend is unavailable. Server authorization remains authoritative.
