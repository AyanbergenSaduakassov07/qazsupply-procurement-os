"""Report review routes (M3): gate state, finding decisions, approve / reject / release.

Thin handlers over services.report.api. Rule violations are 409 with the database's reason code;
non-staff callers get 403 before the database is asked; another tenant's report is 404.
"""

from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, StringConstraints

from services.gateway.deps import OrgConn
from services.report import api as report

router = APIRouter(tags=["review"])
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class ReportDetail(BaseModel):
    id: UUID
    title: str
    period_start: date
    period_end: date
    status: str
    version: int
    created_at: datetime
    created_by: UUID | None
    submitted_at: datetime | None
    released_at: datetime | None
    released_by: UUID | None
    approved_by: UUID | None
    approved_by_name: str | None
    released_by_name: str | None
    findings: int
    undecided: int
    total_saving: Decimal
    four_eyes: bool


class ReviewEntry(BaseModel):
    id: UUID
    finding_id: UUID | None
    reviewer_id: UUID
    decision: Literal["approve", "edit", "reject"]
    note: str | None
    created_at: datetime


class FindingDecision(BaseModel):
    decision: Literal["approve", "edit", "reject"]
    note: Note | None = None


class ReportNote(BaseModel):
    note: Note | None = None


class RejectReport(BaseModel):
    note: Note = Field(min_length=1)


def _run(action: Callable[[], None]) -> None:
    try:
        action()
    except report.NotStaff:
        raise HTTPException(403, {"code": "staff_only"}) from None
    except report.GateError as e:
        status = 404 if e.code == "not_found" else 409
        raise HTTPException(status, {"code": e.code}) from None


def _detail(conn: OrgConn, org_id: UUID, report_id: UUID) -> ReportDetail:
    found = report.get_report(conn, org_id, report_id)
    if found is None:
        raise HTTPException(404, "not found")
    return ReportDetail(**found)


@router.get("/orgs/{org_id}/reports/{report_id}")
def report_detail(org_id: UUID, report_id: UUID, conn: OrgConn) -> ReportDetail:
    return _detail(conn, org_id, report_id)


@router.get("/orgs/{org_id}/reports/{report_id}/reviews")
def report_reviews(org_id: UUID, report_id: UUID, conn: OrgConn) -> list[ReviewEntry]:
    _detail(conn, org_id, report_id)
    return [ReviewEntry(**r) for r in report.reviews(conn, org_id, report_id)]


@router.post("/orgs/{org_id}/reports/{report_id}/findings/{finding_id}/decision")
def decide_finding(
    org_id: UUID, report_id: UUID, finding_id: UUID, body: FindingDecision, conn: OrgConn
) -> ReportDetail:
    _run(
        lambda: report.decide_finding(conn, org_id, report_id, finding_id, body.decision, body.note)
    )
    return _detail(conn, org_id, report_id)


@router.post("/orgs/{org_id}/reports/{report_id}/submit")
def submit(org_id: UUID, report_id: UUID, conn: OrgConn) -> ReportDetail:
    _run(lambda: report.submit(conn, org_id, report_id))
    return _detail(conn, org_id, report_id)


@router.post("/orgs/{org_id}/reports/{report_id}/return")
def return_to_draft(org_id: UUID, report_id: UUID, conn: OrgConn) -> ReportDetail:
    _run(lambda: report.return_to_draft(conn, org_id, report_id))
    return _detail(conn, org_id, report_id)


@router.post("/orgs/{org_id}/reports/{report_id}/approve")
def approve(
    org_id: UUID, report_id: UUID, conn: OrgConn, body: ReportNote | None = None
) -> ReportDetail:
    _run(lambda: report.approve(conn, org_id, report_id, body.note if body else None))
    return _detail(conn, org_id, report_id)


@router.post("/orgs/{org_id}/reports/{report_id}/reject")
def reject(org_id: UUID, report_id: UUID, body: RejectReport, conn: OrgConn) -> ReportDetail:
    _run(lambda: report.reject(conn, org_id, report_id, body.note))
    return _detail(conn, org_id, report_id)


@router.post("/orgs/{org_id}/reports/{report_id}/reopen")
def reopen(org_id: UUID, report_id: UUID, conn: OrgConn) -> ReportDetail:
    _run(lambda: report.reopen(conn, org_id, report_id))
    return _detail(conn, org_id, report_id)


@router.post("/orgs/{org_id}/reports/{report_id}/release")
def release(org_id: UUID, report_id: UUID, conn: OrgConn) -> ReportDetail:
    _run(lambda: report.release(conn, org_id, report_id))
    return _detail(conn, org_id, report_id)
