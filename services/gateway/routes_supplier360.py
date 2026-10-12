"""Supplier 360 routes (M4): supplier list with verdicts, dossier build/read, hit decisions,
re-screening, per-org risk weights. Thin handlers over services.supplier360.api.

Every source is a SAMPLE adapter until real access exists; responses say so (`sample`).
A hit never blocks: decisions need a reason code (422 otherwise); client users cannot decide (403).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from psycopg import errors as pg_errors
from pydantic import BaseModel, StringConstraints

from services.gateway.deps import OrgConn
from services.supplier360 import api as s360

router = APIRouter(tags=["supplier360"])
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class SupplierRow(BaseModel):
    id: UUID
    name: str
    bin: str | None
    built: bool
    verdict: Literal["ok", "caution", "high_risk", "unknown"] | None
    score: int | None
    top: list[str]
    spend_kzt: Decimal
    sample: bool


class Party(BaseModel):
    id: UUID
    kind: Literal["company", "person"]
    name: str
    country: str | None
    bin: str | None
    birth_year: int | None
    registry_status: str | None
    registered_on: date | None
    source_id: str
    source_ref: str
    fetched_at: datetime
    licence: str
    sample: bool
    depth: int


class Link(BaseModel):
    owner_id: UUID
    owned_id: UUID
    role: Literal["shareholder", "beneficial_owner", "director"]
    share_pct: Decimal | None
    source_id: str
    fetched_at: datetime
    sample: bool


class Hit(BaseModel):
    id: UUID
    entry_id: str
    entry_name: str
    entry_topics: list[str]
    score: Decimal
    explanation: dict[str, Any]
    decision: Literal["confirmed", "dismissed"] | None
    reason_code: str | None
    note: str | None
    decided_at: datetime | None
    decided_by_me: bool | None
    decided_by_staff: str | None


class Screening(BaseModel):
    id: UUID
    subject_id: UUID
    list_source: str
    list_version: str
    trigger: str
    result: Literal["clear", "possible_match", "unavailable"]
    sample: bool
    checked_at: datetime
    checked_by_me: bool
    hits: list[Hit]


class Factor(BaseModel):
    code: str
    weight: int
    triggered: bool
    points: int
    detail: dict[str, Any]


class Risk(BaseModel):
    score: int
    verdict: Literal["ok", "caution", "high_risk", "unknown"]
    factors: list[Factor]
    top: list[str]


class Spend(BaseModel):
    lines: int
    total_kzt: Decimal
    unpriced: int
    first_on: date | None
    last_on: date | None
    evidence: dict[str, Any]
    findings: list[dict[str, Any]]


class Dossier(BaseModel):
    supplier: dict[str, Any]
    resolved: bool
    built: bool
    company: Party | None
    nodes: list[Party]
    edges: list[Link]
    screenings: list[Screening]
    items: list[Screening]
    spend: Spend
    risk: Risk | None


class BuildResult(BaseModel):
    party_id: UUID | None
    degraded: list[dict[str, Any]]
    truncated: bool
    screenings: int
    possible_matches: int


class Decision(BaseModel):
    decision: Literal["confirmed", "dismissed"]
    reason_code: str
    note: Note | None = None


class Weights(BaseModel):
    defaults: dict[str, int]
    weights: dict[str, int]


class WeightsUpdate(BaseModel):
    weights: dict[str, int]


@router.get("/orgs/{org_id}/suppliers")
def list_suppliers(org_id: UUID, conn: OrgConn) -> list[SupplierRow]:
    return [SupplierRow(**r) for r in s360.suppliers(conn, org_id)]


@router.post("/orgs/{org_id}/suppliers/{supplier_id}/dossier")
def build_dossier(org_id: UUID, supplier_id: UUID, conn: OrgConn) -> BuildResult:
    try:
        b = s360.build(conn, org_id, supplier_id)
    except LookupError:
        raise HTTPException(404, "not found") from None
    except s360.Unresolved:
        raise HTTPException(409, {"code": "supplier_unresolved"}) from None
    return BuildResult(**b.__dict__)


@router.get("/orgs/{org_id}/suppliers/{supplier_id}/dossier")
def read_dossier(org_id: UUID, supplier_id: UUID, conn: OrgConn) -> Dossier:
    try:
        return Dossier(**s360.dossier(conn, org_id, supplier_id))
    except LookupError:
        raise HTTPException(404, "not found") from None


@router.post("/orgs/{org_id}/screening-hits/{hit_id}/decision", status_code=204)
def decide_hit(org_id: UUID, hit_id: UUID, conn: OrgConn, body: Decision) -> None:
    try:
        s360.decide(conn, org_id, hit_id, body.decision, body.reason_code, body.note)
    except ValueError as e:
        raise HTTPException(422, {"code": str(e)}) from None
    except LookupError:
        raise HTTPException(404, "not found") from None
    except pg_errors.InsufficientPrivilege:
        raise HTTPException(403, {"code": "admins_and_reviewers_only"}) from None


@router.post("/orgs/{org_id}/screenings/rescreen-due")
def rescreen(org_id: UUID, conn: OrgConn) -> dict[str, int]:
    return {"rescreened": s360.rescreen_due(conn, org_id)}


@router.get("/orgs/{org_id}/risk-weights")
def get_weights(org_id: UUID, conn: OrgConn) -> Weights:
    return Weights(**s360.risk_weights(conn, org_id))


@router.put("/orgs/{org_id}/risk-weights")
def put_weights(org_id: UUID, conn: OrgConn, body: WeightsUpdate) -> Weights:
    try:
        return Weights(**s360.set_risk_weights(conn, org_id, body.weights))
    except PermissionError:
        raise HTTPException(403, {"code": "admins_only"}) from None
