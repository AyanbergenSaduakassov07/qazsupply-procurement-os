"""Supplier onboarding routes (M4). Buyers invite and decide; the supplier fills in its own case.
The database enforces the state machine; its reason codes come back as 409 {code}.
Documents download as attachments only (untrusted files are never rendered inline)."""

from datetime import date, datetime
from typing import Annotated, Literal
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, StringConstraints

from services.gateway.deps import OrgConn
from services.supplier360 import api as s360

router = APIRouter(tags=["onboarding"])
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]


class Invite(BaseModel):
    supplier_id: UUID
    email: Short


class Details(BaseModel):
    legal_name: Short | None = None
    bin: Annotated[str, StringConstraints(pattern=r"^[0-9]{12}$")] | None = None
    contact_name: Short | None = None
    contact_phone: Annotated[str, StringConstraints(pattern=r"^\+?[0-9 ()-]{6,20}$")] | None = None


class OnboardingDecision(BaseModel):
    decision: Literal["approve", "reject", "return"]
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None


class Document(BaseModel):
    id: UUID
    kind: str
    file_name: str
    content_type: str
    size_bytes: int
    sha256: str
    doc_number: str | None
    issued_on: date | None
    fields_confirmed: bool
    created_at: datetime


class Case(BaseModel):
    id: UUID
    supplier_id: UUID | None
    supplier_name: str | None
    status: Literal["invited", "in_progress", "submitted", "approved", "rejected"]
    legal_name: str | None
    bin: str | None
    contact_name: str | None
    contact_phone: str | None
    confirmed: bool
    created_at: datetime
    submitted_at: datetime | None
    decided_at: datetime | None
    decision_note: str | None
    decided_by_staff: str | None
    mine: bool


class CaseDetail(Case):
    documents: list[Document]


def _rejected(e: s360.OnboardingRejected) -> HTTPException:
    bad_file = e.code in ("unsupported_file_type", "too_large", "empty")
    return HTTPException(422 if bad_file else 409,
                         {"code": e.code})  # fmt: skip


@router.get("/orgs/{org_id}/onboarding")
def list_cases(org_id: UUID, conn: OrgConn) -> list[Case]:
    return [Case(**c) for c in s360.onboarding_cases(conn, org_id)]


@router.post("/orgs/{org_id}/onboarding", status_code=201)
def invite(org_id: UUID, conn: OrgConn, body: Invite) -> dict[str, UUID]:
    try:
        return {"id": s360.invite_supplier(conn, org_id, body.supplier_id, body.email)}
    except s360.OnboardingRejected as e:
        raise _rejected(e) from None
    except LookupError:
        raise HTTPException(404, "not found") from None


@router.get("/orgs/{org_id}/onboarding/{case_id}")
def get_case(org_id: UUID, case_id: UUID, conn: OrgConn) -> CaseDetail:
    try:
        return CaseDetail(**s360.onboarding_case(conn, org_id, case_id))
    except LookupError:
        raise HTTPException(404, "not found") from None


@router.put("/orgs/{org_id}/onboarding/{case_id}/details", status_code=204)
def save_details(org_id: UUID, case_id: UUID, conn: OrgConn, body: Details) -> None:
    try:
        s360.save_onboarding_details(conn, org_id, case_id, body.model_dump(exclude_none=True))
    except s360.OnboardingRejected as e:
        raise _rejected(e) from None
    except LookupError:
        raise HTTPException(404, "not found") from None


@router.post("/orgs/{org_id}/onboarding/{case_id}/documents", status_code=201)
def upload_document(
    org_id: UUID,
    case_id: UUID,
    conn: OrgConn,
    file: Annotated[UploadFile, File()],
    kind: Annotated[str, Form()],
    fields_confirmed: Annotated[bool, Form()] = False,
    doc_number: Annotated[str | None, Form(max_length=100)] = None,
    issued_on: Annotated[date | None, Form()] = None,
) -> dict[str, UUID]:
    data = file.file.read(s360.MAX_DOC_BYTES + 1)
    try:
        doc_id = s360.add_onboarding_document(
            conn, org_id, case_id, kind=kind, file_name=file.filename or "document", data=data,
            doc_number=doc_number, issued_on=issued_on, fields_confirmed=fields_confirmed,
        )  # fmt: skip
    except s360.OnboardingRejected as e:
        raise _rejected(e) from None
    except LookupError:
        raise HTTPException(404, "not found") from None
    return {"id": doc_id}


@router.get("/orgs/{org_id}/onboarding/{case_id}/documents/{doc_id}")
def download_document(org_id: UUID, case_id: UUID, doc_id: UUID, conn: OrgConn) -> Response:
    try:
        d = s360.onboarding_document(conn, org_id, case_id, doc_id)
    except LookupError:
        raise HTTPException(404, "not found") from None
    return Response(
        content=bytes(d["content"]),
        media_type=d["content_type"],
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{_quote(d['file_name'])}",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.post("/orgs/{org_id}/onboarding/{case_id}/submit", status_code=204)
def submit(org_id: UUID, case_id: UUID, conn: OrgConn) -> None:
    try:
        s360.submit_onboarding(conn, org_id, case_id)
    except s360.OnboardingRejected as e:
        raise _rejected(e) from None
    except LookupError:
        raise HTTPException(404, "not found") from None


@router.post("/orgs/{org_id}/onboarding/{case_id}/decision")
def decide(org_id: UUID, case_id: UUID, conn: OrgConn, body: OnboardingDecision) -> dict[str, int]:
    try:
        built = s360.decide_onboarding(conn, org_id, case_id, body.decision, body.note)
    except s360.OnboardingRejected as e:
        raise _rejected(e) from None
    except LookupError:
        raise HTTPException(404, "not found") from None
    return {"screenings": built.screenings if built else 0}


def _quote(name: str) -> str:
    return quote(name, safe="")
