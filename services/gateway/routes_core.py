"""Core routes (M1): identity, reports, evidence, audit log. Thin handlers over module APIs."""

from datetime import date, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.evidence import api as evidence
from services.gateway.deps import Conn, OrgConn, Who
from services.report import api as report
from services.tenancy import api as tenancy

router = APIRouter()


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
    submitted_at: datetime | None
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
@router.get("/me")
def me(who: Who, conn: Conn) -> Me:
    rows = tenancy.memberships(conn, who.user_id)
    email = who.claims.get("email")
    return Me(
        user_id=who.user_id,
        email=email if isinstance(email, str) else None,
        memberships=[Membership(**r) for r in rows],
    )


@router.get("/orgs/{org_id}/reports")
def reports(org_id: UUID, conn: OrgConn) -> list[Report]:
    return [Report(**r) for r in report.list_reports(conn, org_id)]


@router.get("/orgs/{org_id}/evidence/{evidence_id}")
def evidence_detail(org_id: UUID, evidence_id: UUID, conn: OrgConn) -> Evidence:
    found = evidence.get(conn, org_id, evidence_id)
    if found is None:
        raise HTTPException(404, "not found")
    return Evidence(**found)


@router.get("/orgs/{org_id}/audit-log")
def audit_log(
    org_id: UUID, conn: OrgConn, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> AuditLog:
    if not tenancy.is_admin(conn, org_id):
        raise HTTPException(403, "forbidden")
    entries = [AuditEntry(**r) for r in tenancy.audit_log(conn, org_id, limit)]
    return AuditLog(chain_intact=tenancy.audit_chain_intact(conn, org_id), entries=entries)
