# services/gateway

FastAPI composition root: wires every service module into one HTTP app. Owns auth, tenancy context and request ids (M1).

**Public interface (M0):** `services.gateway.app:app`, an ASGI app.
- `GET /health` -> `{"status": "ok"}` (liveness only; no DB check until M1).

**Run:** `pnpm dev` from the repo root (port 8000), or `uv run uvicorn services.gateway.app:app --reload`.

**Rules:** route handlers never touch the DB directly; they call service modules. See root `CLAUDE.md`.
