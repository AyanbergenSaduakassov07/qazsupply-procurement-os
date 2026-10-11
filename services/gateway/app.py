"""Composition root: wires auth, tenancy context and service modules into one HTTP app.

Route handlers stay thin: authenticate, open a user-scoped transaction, call a module.
"""

import logging
import re
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import errors as pg_errors
from pydantic import BaseModel

from services.gateway import log, routes_core, routes_report, routes_spend
from services.gateway.auth import Verifier
from services.gateway.db import Database
from services.gateway.settings import load

logger = logging.getLogger("gateway")
settings = load()
REQUEST_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.configure()
    app.state.db = Database(settings.database_url)
    app.state.verifier = Verifier(settings.jwks_url)
    try:
        app.state.db.open()
    except Exception as e:  # noqa: BLE001 - API must start even when the DB is down; /health reports it
        logger.warning("database unavailable at startup", extra={"error_type": type(e).__name__})
    yield
    app.state.db.close()


app = FastAPI(title="QazSupply API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
)


@app.exception_handler(pg_errors.InsufficientPrivilege)
async def rls_denied(request: Request, exc: pg_errors.InsufficientPrivilege) -> JSONResponse:
    # RLS or a missing grant refused the write: the caller lacks the role, not a server bug.
    logger.info("write denied by database policy", extra={"error_type": "InsufficientPrivilege"})
    return JSONResponse(status_code=403, content={"detail": {"code": "forbidden"}})


@app.middleware("http")
async def request_context(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    incoming = request.headers.get("x-request-id", "")
    rid = incoming if REQUEST_ID.match(incoming) else uuid.uuid4().hex
    token = log.request_id.set(rid)
    started = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        log.request_id.reset(token)
    route = request.scope.get("route")
    logger.info(
        "request",
        extra={
            "route": getattr(route, "path", "unmatched"),
            "method": request.method,
            "status": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000, 1),
        },
    )
    response.headers["X-Request-Id"] = rid
    return response


class Health(BaseModel):
    status: Literal["ok"]
    db: Literal["ok", "down"]


@app.get("/health")
def health(request: Request, response: Response) -> Health:
    db: Database = request.app.state.db
    try:
        ok = db.ping()
    except Exception as e:  # noqa: BLE001 - health must answer, not raise
        logger.warning("db ping failed", extra={"error_type": type(e).__name__})
        ok = False
    if not ok:
        response.status_code = 503
    return Health(status="ok", db="ok" if ok else "down")


app.include_router(routes_spend.build())
app.include_router(routes_core.router)
app.include_router(routes_report.router)
