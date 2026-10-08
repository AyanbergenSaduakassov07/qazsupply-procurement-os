"""Composition root: wires auth, tenancy context and service modules into one HTTP app.

Route handlers stay thin: authenticate, open a user-scoped transaction, call a module.
"""

import logging
import re
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from services.evidence import api as evidence
from services.gateway import log
from services.gateway.auth import AuthError, Principal, Verifier
from services.gateway.db import Database, UserConn
from services.gateway.settings import load
from services.report import api as report
from services.tenancy import api as tenancy

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


# ---------------------------------------------------------------- dependencies
bearer = HTTPBearer(auto_error=False)


def principal(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Principal:
    if creds is None:
        raise HTTPException(401, "unauthorized")
    verifier: Verifier = request.app.state.verifier
    try:
        return verifier.verify(creds.credentials)
    except AuthError:
        raise HTTPException(401, "unauthorized") from None


def user_conn(
    request: Request, who: Annotated[Principal, Depends(principal)]
) -> Iterator[UserConn]:
    db: Database = request.app.state.db
    with db.as_user(who) as conn:
        yield conn


def member_conn(org_id: UUID, conn: Annotated[UserConn, Depends(user_conn)]) -> UserConn:
    # 404, not 403: never confirm that another tenant's org exists.
    if not tenancy.is_member(conn, org_id):
        raise HTTPException(404, "not found")
    return conn


Who = Annotated[Principal, Depends(principal)]
Conn = Annotated[UserConn, Depends(user_conn)]
OrgConn = Annotated[UserConn, Depends(member_conn)]


# ---------------------------------------------------------------- schemas
class Health(BaseModel):
    status: Literal["ok"]
    db: Literal["ok", "down"]


class Membership(BaseModel):
    org_id: UUID
    org_name: str
    role: Literal["client_admin", "client_user", "reviewer", "qazsupply_admin", "supplier"]


class Me(BaseModel):
    user_id: UUID
    email: str | None
    memberships: list[Membership]


class Report(BaseModel):
    id: UUID
    title: str
    period_start: date
    period_end: date
    status: str
    version: int
    released_at: datetime | None


class EvidenceSource(BaseModel):
    purchase_line_id: UUID
    file_name: str
    source_row: int
    item_text: str | None
    supplier_text: str | None
    quantity: float | None
    unit: str | None
    unit_price: float | None
    currency: str | None
    purchased_on: date | None


class EvidenceFinding(BaseModel):
    finding_id: UUID
    type: str
    report_id: UUID | None
    reviewed_by: UUID | None


class Evidence(BaseModel):
    id: UUID
    org_id: UUID
    computation_id: str
    method: str
    code_version: str
    inputs: dict[str, Any]
    result: float | None
    created_at: datetime
    sources: list[EvidenceSource]
    findings: list[EvidenceFinding]


class AuditEntry(BaseModel):
    id: int
    actor_id: UUID | None
    action: str
    entity: str
    entity_id: UUID | None
    details: dict[str, Any]
    created_at: datetime
    hash: str


class AuditLog(BaseModel):
    chain_intact: bool
    entries: list[AuditEntry]


# ---------------------------------------------------------------- routes
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


@app.get("/me")
def me(who: Who, conn: Conn) -> Me:
    rows = tenancy.memberships(conn, who.user_id)
    email = who.claims.get("email")
    return Me(
        user_id=who.user_id,
        email=email if isinstance(email, str) else None,
        memberships=[Membership(**r) for r in rows],
    )


@app.get("/orgs/{org_id}/reports")
def reports(org_id: UUID, conn: OrgConn) -> list[Report]:
    return [Report(**r) for r in report.list_reports(conn, org_id)]


@app.get("/orgs/{org_id}/evidence/{evidence_id}")
def evidence_detail(org_id: UUID, evidence_id: UUID, conn: OrgConn) -> Evidence:
    found = evidence.get(conn, org_id, evidence_id)
    if found is None:
        raise HTTPException(404, "not found")
    return Evidence(**found)


@app.get("/orgs/{org_id}/audit-log")
def audit_log(
    org_id: UUID, conn: OrgConn, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> AuditLog:
    if not tenancy.is_admin(conn, org_id):
        raise HTTPException(403, "forbidden")
    entries = [AuditEntry(**r) for r in tenancy.audit_log(conn, org_id, limit)]
    return AuditLog(chain_intact=tenancy.audit_chain_intact(conn, org_id), entries=entries)
