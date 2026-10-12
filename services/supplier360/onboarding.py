"""Supplier onboarding (M4): invite -> details + documents -> submit -> human check.

The state machine is enforced in the database (migration 20261013010000); this module checks
inputs, maps the database's reason codes, and starts a screening when a case is approved.
Documents are untrusted: type by magic bytes, size capped, served only as attachments.
"""

import hashlib
import re
from datetime import date
from typing import Any
from uuid import UUID

from psycopg import errors as pg_errors

from services.gateway.db import UserConn

MAX_DOC_BYTES = 5 * 1024 * 1024
MAGIC = {
    b"%PDF-": "application/pdf",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
}
KINDS = ("registration_certificate", "charter", "bank_letter", "other")
CASE_COLUMNS = """id, org_id, supplier_id, status, legal_name, bin, contact_name, contact_phone,
  confirmed, created_at, submitted_at, decided_at, decision_note,
  supplier_user_id = auth.uid() as mine, private.staff_name(decided_by) as decided_by_staff,
  (select s.name from public.suppliers s where s.id = supplier_id) as supplier_name"""


class Rejected(Exception):
    """A rule refused the change; `code` is the reason shown to the user."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _db_rule(e: pg_errors.CheckViolation) -> Rejected:
    match = re.search(r"onboarding:([a-z_]+)", str(e))
    return Rejected(match.group(1) if match else "invalid")


def sniff(data: bytes) -> str:
    for magic, content_type in MAGIC.items():
        if data.startswith(magic):
            return content_type
    raise Rejected("unsupported_file_type")


def invite(conn: UserConn, org_id: UUID, supplier_id: UUID, email: str) -> UUID:
    row = conn.execute(
        "select private.supplier_member_by_email(%s, %s) as uid", (org_id, email)
    ).fetchone()
    if row is None or row["uid"] is None:
        raise Rejected("not_a_supplier_member")
    try:
        new = conn.execute(
            """insert into public.onboarding_cases (org_id, supplier_id, supplier_user_id)
               values (%s, %s, %s) returning id""",
            (org_id, supplier_id, row["uid"]),
        ).fetchone()
    except pg_errors.CheckViolation as e:
        raise _db_rule(e) from None
    except pg_errors.ForeignKeyViolation:
        raise LookupError("supplier not found") from None
    assert new is not None
    return UUID(str(new["id"]))


def cases(conn: UserConn, org_id: UUID) -> list[dict[str, Any]]:
    rows = conn.execute(
        f"""select {CASE_COLUMNS} from public.onboarding_cases
            where org_id = %s order by created_at desc""",  # noqa: S608 - constant columns
        (org_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def case(conn: UserConn, org_id: UUID, case_id: UUID) -> dict[str, Any]:
    row = conn.execute(
        f"select {CASE_COLUMNS} from public.onboarding_cases where org_id = %s and id = %s",  # noqa: S608 - constant columns
        (org_id, case_id),
    ).fetchone()
    if row is None:
        raise LookupError("case not found")
    docs = conn.execute(
        """select id, kind, file_name, content_type, size_bytes, sha256, doc_number, issued_on,
                  fields_confirmed, created_at
           from public.onboarding_documents where org_id = %s and case_id = %s
           order by created_at""",
        (org_id, case_id),
    ).fetchall()
    return {**dict(row), "documents": [dict(d) for d in docs]}


def _update(conn: UserConn, org_id: UUID, case_id: UUID, sets: dict[str, Any]) -> None:
    cols = ", ".join(f"{k} = %({k})s" for k in sets)
    try:
        row = conn.execute(
            f"""update public.onboarding_cases set {cols}
                where org_id = %(org)s and id = %(id)s returning id""",  # noqa: S608 - fixed keys
            {**sets, "org": org_id, "id": case_id},
        ).fetchone()
    except pg_errors.CheckViolation as e:
        raise _db_rule(e) from None
    if row is None:
        raise LookupError("case not found")


def save_details(conn: UserConn, org_id: UUID, case_id: UUID, details: dict[str, Any]) -> None:
    """Supplier: details are saved and the case moves to in_progress."""
    allowed: dict[str, Any] = {
        k: details[k]
        for k in ("legal_name", "bin", "contact_name", "contact_phone")
        if k in details
    }
    _update(conn, org_id, case_id, {**allowed, "status": "in_progress"})


def add_document(
    conn: UserConn, org_id: UUID, case_id: UUID, *, kind: str, file_name: str, data: bytes,
    doc_number: str | None, issued_on: date | None, fields_confirmed: bool,
) -> UUID:  # fmt: skip
    if kind not in KINDS:
        raise Rejected("invalid_kind")
    if not data or len(data) > MAX_DOC_BYTES:
        raise Rejected("too_large" if data else "empty")
    content_type = sniff(data)
    safe_name = re.sub(r"[^\w.\- ]", "_", file_name)[:255] or "document"
    try:
        row = conn.execute(
            """insert into public.onboarding_documents (org_id, case_id, kind, file_name,
                 content_type, size_bytes, sha256, content, doc_number, issued_on, fields_confirmed)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
            (org_id, case_id, kind, safe_name, content_type, len(data),
             hashlib.sha256(data).hexdigest(), data, (doc_number or "").strip()[:100] or None,
             issued_on, fields_confirmed),
        ).fetchone()  # fmt: skip
    except pg_errors.CheckViolation as e:
        raise _db_rule(e) from None
    except pg_errors.ForeignKeyViolation:
        raise LookupError("case not found") from None
    assert row is not None
    return UUID(str(row["id"]))


def document(conn: UserConn, org_id: UUID, case_id: UUID, doc_id: UUID) -> dict[str, Any]:
    row = conn.execute(
        """select file_name, content_type, content from public.onboarding_documents
           where org_id = %s and case_id = %s and id = %s""",
        (org_id, case_id, doc_id),
    ).fetchone()
    if row is None:
        raise LookupError("document not found")
    return dict(row)


def submit(conn: UserConn, org_id: UUID, case_id: UUID) -> None:
    _update(conn, org_id, case_id, {"confirmed": True, "status": "submitted"})


def decide(
    conn: UserConn, org_id: UUID, case_id: UUID, decision: str, note: str | None
) -> str | None:
    """Buyer/staff: approve, reject or return. Returns the supplier id to screen on approval."""
    status = {"approve": "approved", "reject": "rejected", "return": "in_progress"}.get(decision)
    if status is None:
        raise Rejected("invalid_decision")
    _update(
        conn, org_id, case_id, {"status": status, "decision_note": (note or "").strip() or None}
    )
    if status != "approved":
        return None
    row = conn.execute(
        "select supplier_id from public.onboarding_cases where id = %s", (case_id,)
    ).fetchone()
    return None if row is None or row["supplier_id"] is None else str(row["supplier_id"])
