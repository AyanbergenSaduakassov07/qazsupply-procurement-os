"""Spend X-ray routes (M2): uploads. Thin handlers; logic lives in services.ingest.api."""

import json
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from services.gateway.db import UserConn
from services.ingest import api as ingest
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
