# services/gateway

FastAPI composition root. Wires auth, tenancy context and service modules into one HTTP app. Route handlers stay thin: authenticate, open a user-scoped transaction, call a module.

**Public interface:** `services.gateway.app:app` (ASGI). OpenAPI: `packages/api-client/openapi.json`.

**Layout:** `app.py` (composition root: lifespan, middleware, `/health`), `deps.py` (auth, user-scoped connection, membership check), `routes_core.py` (M1), `routes_spend.py` (M2). Integration-test helpers live in `testing.py` and `conftest.py`.

Core (M1):
- `GET /health` -> `{"status":"ok","db":"ok"|"down"}` (503 when the DB is down)
- `GET /me` -> user id, email, memberships
- `GET /orgs/{org_id}/reports`, `GET /orgs/{org_id}/evidence/{evidence_id}`, `GET /orgs/{org_id}/audit-log?limit=` (admins; 403 otherwise)

Spend X-ray (M2):
- `POST /orgs/{org_id}/uploads/preview`, `POST /orgs/{org_id}/uploads`, `GET /orgs/{org_id}/uploads`
- `POST /orgs/{org_id}/normalize`, `GET /orgs/{org_id}/match-counts`, `GET /orgs/{org_id}/classifier`
- `GET /orgs/{org_id}/review-queue`, `POST /orgs/{org_id}/purchase-lines/{line_id}/review` (accept / choose / reject / undo)
- `POST /orgs/{org_id}/analysis` (staff only), `GET /orgs/{org_id}/reports/{report_id}/findings`

**Security model:** Supabase JWT verified against the project JWKS (ES256/RS256, `aud=authenticated`). Every query runs as Postgres role `authenticated` with the caller's claims (`services.gateway.db.Database.as_user`), so RLS applies to the API exactly as in the pgTAP tests. Another tenant's org or id is always `404`, never `403`.

**Logs:** JSON, allowlisted fields only (route template, method, status, duration, request id). No URLs, query strings, emails or prices. `X-Request-Id` is echoed when well-formed, otherwise generated.

**Env:** `DATABASE_URL`, `SUPABASE_URL`, `CORS_ORIGINS` (defaults point at the local Supabase stack).
