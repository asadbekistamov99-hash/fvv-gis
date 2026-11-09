# FVV GIS administration

React + TypeScript + Vite + Tailwind + TanStack Query + MapLibre GL JS. Uzbek Latin is the default, with Russian/English and light/dark themes.

```sh
npm ci
npm run dev
npm run build
npm test
```

Vite proxies `/api` to FastAPI on `127.0.0.1:8000`. Configure `API_PROXY_TARGET` for another local API. `VITE_API_URL` is compiled into the bundle and must never contain credentials. `VITE_MAP_STYLE_URL` defaults to `/tiles/style.json`; configure a licensed self-hosted MapLibre style. A missing basemap is visibly identified, and operational objects are still loaded from the authenticated API. No public third-party basemap is silently substituted.

The application uses real phone OTP authentication. It displays a development OTP only when the backend explicitly returns `dev_otp`. Administrators enroll/verify TOTP through backend MFA endpoints. Access and refresh tokens are held in memory only; reloading requires login. Language and theme preferences are the only settings persisted in localStorage. API responses are never replaced with mock records when the backend is unavailable.

The interface supports scope-filtered registry/map, technical passports, geometry drawing, draft/submission workflow, approval/rejection/publication, employee verification, report assignment, inspections, notifications, versioned category schemas, audit, and evidence-based backup status. Server authorization remains authoritative. Real reports are non-emergency intake; this is an independent proposal without official dispatch integration or endorsement.
