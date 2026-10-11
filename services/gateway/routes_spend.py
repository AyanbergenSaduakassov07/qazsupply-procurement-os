"""Spend X-ray routes (M2): uploads. Thin handlers; logic lives in services.ingest.api."""

import json
from datetime import date, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from services.gateway.db import UserConn
from services.ingest import api as ingest
from services.normalize import api as normalize
from services.tenancy import api as tenancy


def build(member_conn: Any) -> APIRouter:
    """`member_conn` is the gateway dependency that 404s non-members (injected to avoid a cycle)."""
    router = APIRouter(tags=["spend"])
    OrgConn = Annotated[UserConn, Depends(member_conn)]

    @router.post("/orgs/{org_id}/uploads/preview")
    async def upload_preview(
        org_id: UUID,
        conn: OrgConn,
        file: Annotated[UploadFile, File()],
        sheet: Annotated[str | None, Form()] = None,
    ) -> UploadPreview:
        data = await _read(file)
        try:
            p = ingest.preview(data, file.filename or "upload", sheet)
        except ingest.FileRejected as e:
            raise HTTPException(422, {"code": e.code}) from None
        return UploadPreview(**p.__dict__)

    @router.post("/orgs/{org_id}/uploads")
    async def upload(
        org_id: UUID,
        conn: OrgConn,
        file: Annotated[UploadFile, File()],
        mapping: Annotated[str, Form(description="JSON object: field -> 0-based column")],
        sheet: Annotated[str | None, Form()] = None,
        header_row: Annotated[int | None, Form()] = None,
    ) -> UploadResult:
        data = await _read(file)
        try:
            parsed = {str(k): int(v) for k, v in json.loads(mapping).items()}
        except (ValueError, AttributeError, TypeError):
            raise HTTPException(422, {"code": "bad_mapping"}) from None
        try:
            r = ingest.ingest(
                conn, org_id, data, file.filename or "upload", parsed, sheet, header_row
            )
        except ingest.FileRejected as e:
            raise HTTPException(422, {"code": e.code}) from None
        if not r.duplicate:
            tenancy.append_audit(
                conn,
                org_id,
                "file.uploaded",
                "files",
                r.file_id,
                {"inserted": r.inserted, "rejected": r.rejected},
            )
        return UploadResult(
            file_id=r.file_id,
            duplicate=r.duplicate,
            inserted=r.inserted,
            rejected=r.rejected,
            errors=[RowError(**e.__dict__) for e in r.errors[:500]],
        )

    @router.get("/orgs/{org_id}/uploads")
    def uploads(org_id: UUID, conn: OrgConn) -> list[UploadSummary]:
        return [UploadSummary(**r) for r in ingest.list_uploads(conn, org_id)]

    @router.post("/orgs/{org_id}/normalize")
    def normalize_run(org_id: UUID, conn: OrgConn, body: NormalizeRequest) -> NormalizeSummary:
        r = normalize.run(conn, org_id, body.file_id)
        return NormalizeSummary(**r.__dict__)

    @router.get("/orgs/{org_id}/match-counts")
    def match_counts(org_id: UUID, conn: OrgConn) -> dict[str, int]:
        return normalize.counts(conn, org_id)

    @router.get("/orgs/{org_id}/review-queue")
    def review_queue(org_id: UUID, conn: OrgConn, limit: int = 50, offset: int = 0) -> ReviewQueue:
        limit = max(1, min(limit, 200))
        rows = normalize.queue(conn, org_id, limit, max(offset, 0))
        return ReviewQueue(sample_classifier=True, lines=[QueueLine(**r) for r in rows])

    @router.post("/orgs/{org_id}/purchase-lines/{line_id}/review")
    def review_line(
        org_id: UUID, line_id: UUID, conn: OrgConn, body: ReviewRequest
    ) -> ReviewResult:
        try:
            r = normalize.review(conn, org_id, line_id, body.action, body.code)
        except LookupError:
            raise HTTPException(404, "not found") from None
        except ValueError as e:
            raise HTTPException(422, {"code": str(e).replace(" ", "_")}) from None
        return ReviewResult(**r)

    @router.get("/orgs/{org_id}/classifier")
    def classifier_search(org_id: UUID, conn: OrgConn, q: str = "", limit: int = 20) -> Classifier:
        needle = q.strip().lower()
        hits = [
            e
            for e in normalize.classifier().values()
            if not needle
            or needle in e.name_ru.lower()
            or needle in e.name_kk.lower()
            or needle in e.code.lower()
        ]
        return Classifier(sample=True, entries=[ClassifierItem(**e.__dict__) for e in hits[:limit]])

    return router


async def _read(file: UploadFile) -> bytes:
    data = await file.read(ingest.MAX_BYTES + 1)
    if len(data) > ingest.MAX_BYTES:
        raise HTTPException(413, {"code": "too_large"})
    return data


class UploadPreview(BaseModel):
    sha256: str
    sheets: list[str]
    sheet: str
    header_row: int
    columns: list[str]
    mapping: dict[str, int]
    missing_required: list[str]
    sample: list[list[str]]
    rows_total: int
    errors_by_code: dict[str, int]


class RowError(BaseModel):
    row: int
    code: str
    column: str | None


class UploadResult(BaseModel):
    file_id: UUID
    duplicate: bool
    inserted: int
    rejected: int
    errors: list[RowError]


class UploadSummary(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    rows_total: int
    rows_rejected: int
    lines: int


class NormalizeRequest(BaseModel):
    file_id: UUID | None = None


class NormalizeSummary(BaseModel):
    processed: int
    auto: int
    review: int
    bundled: int
    fx_missing: int
    suppliers_created: int
    sample_classifier: bool


class Candidate(BaseModel):
    code: str
    score: float
    matched: list[str]
    name: str


class QueueLine(BaseModel):
    id: UUID
    item_text: str | None
    unit: str | None
    unit_price: float | None
    currency: str | None
    purchased_on: date | None
    supplier_text: str | None
    match_status: str
    match_confidence: float | None
    match_candidates: list[Candidate]
    source_row: int
    file_name: str | None


class ReviewQueue(BaseModel):
    sample_classifier: bool
    lines: list[QueueLine]


class ReviewRequest(BaseModel):
    action: Literal["accept", "choose", "reject", "undo"]
    code: str | None = None


class ReviewResult(BaseModel):
    id: UUID
    match_status: str
    code: str | None


class ClassifierItem(BaseModel):
    code: str
    name_ru: str
    name_kk: str
    unit: str


class Classifier(BaseModel):
    sample: bool
    entries: list[ClassifierItem]
