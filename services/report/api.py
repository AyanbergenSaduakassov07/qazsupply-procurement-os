"""Report module: read side and the review workflow (M3).

The database enforces the release flow (migration 20261012000000_m3_review_gate.sql); this module
adds an explicit staff check so the API refuses before the database has to, and turns database
rule violations into `GateError` with the same reason code. Clients only ever see released
reports and the findings a reviewer kept (RLS).
"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Literal
from uuid import UUID

from psycopg import errors as pg_errors

from services.gateway.db import UserConn
from services.tenancy import api as tenancy

Decision = Literal["approve", "edit", "reject"]
GATE_PREFIX = "review_gate:"


class NotStaff(Exception):
    """The caller is not a reviewer or QazSupply admin of this organization."""


class GateError(Exception):
    """A review-gate rule refused the action; `code` is the reason (e.g. `undecided_findings`)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def gate_code(exc: pg_errors.CheckViolation) -> str | None:
    """The reason code of a review-gate violation, or None for an ordinary check constraint."""
    message = exc.diag.message_primary or ""
    return message.removeprefix(GATE_PREFIX) if message.startswith(GATE_PREFIX) else None


def list_reports(conn: UserConn, org_id: UUID) -> list[dict[str, Any]]:
    return conn.execute(
        """select id, title, period_start, period_end, status::text as status, version,
             submitted_at, released_at
           from public.reports where org_id = %s
           order by (status = 'in_review') desc, submitted_at nulls last, period_end desc""",
        (org_id,),
    ).fetchall()


def get_report(conn: UserConn, org_id: UUID, report_id: UUID) -> dict[str, Any] | None:
    """One report with its gate state; None when missing or not visible to the caller."""
    return conn.execute(
        """select r.id, r.title, r.period_start, r.period_end, r.status::text as status,
             r.version, r.created_at, r.created_by, r.submitted_at, r.released_at, r.released_by,
             private.latest_report_approver(r.id) as approved_by,
             (select count(*)::int from public.findings f where f.report_id = r.id) as findings,
             private.undecided_findings(r.id) as undecided,
             coalesce((select sum(f.saving_estimate) from public.findings f
                       where f.report_id = r.id and not private.finding_rejected(f.id)), 0)
               as total_saving,
             o.four_eyes
           from public.reports r join public.organizations o on o.id = r.org_id
           where r.org_id = %s and r.id = %s""",
        (org_id, report_id),
    ).fetchone()


def reviews(conn: UserConn, org_id: UUID, report_id: UUID) -> list[dict[str, Any]]:
    """Decision history, oldest first (clients see only what RLS allows)."""
    return conn.execute(
        """select id, finding_id, reviewer_id, decision::text as decision, note, created_at
           from public.reviews where org_id = %s and report_id = %s
           order by created_at, id""",
        (org_id, report_id),
    ).fetchall()


def submit(conn: UserConn, org_id: UUID, report_id: UUID) -> None:
    _set_status(conn, org_id, report_id, "in_review")


def return_to_draft(conn: UserConn, org_id: UUID, report_id: UUID) -> None:
    _set_status(conn, org_id, report_id, "draft")


def decide_finding(
    conn: UserConn,
    org_id: UUID,
    report_id: UUID,
    finding_id: UUID,
    decision: Decision,
    note: str | None,
) -> None:
    _review(conn, org_id, report_id, finding_id, decision, note)


def approve(conn: UserConn, org_id: UUID, report_id: UUID, note: str | None) -> None:
    """Sign the approval and move to `approved` in one transaction."""
    _review(conn, org_id, report_id, None, "approve", note)
    _set_status(conn, org_id, report_id, "approved")


def reject(conn: UserConn, org_id: UUID, report_id: UUID, note: str) -> None:
    _review(conn, org_id, report_id, None, "reject", note)
    _set_status(conn, org_id, report_id, "rejected")


def reopen(conn: UserConn, org_id: UUID, report_id: UUID) -> None:
    _set_status(conn, org_id, report_id, "in_review")


def release(conn: UserConn, org_id: UUID, report_id: UUID) -> None:
    _set_status(conn, org_id, report_id, "released")


def _require_staff(conn: UserConn, org_id: UUID) -> None:
    if not tenancy.is_staff(conn, org_id):
        raise NotStaff


def _review(
    conn: UserConn,
    org_id: UUID,
    report_id: UUID,
    finding_id: UUID | None,
    decision: Decision,
    note: str | None,
) -> None:
    _require_staff(conn, org_id)
    with _gate():
        conn.execute(
            """insert into public.reviews (org_id, report_id, finding_id, decision, note)
               values (%s, %s, %s, %s, %s)""",
            (org_id, report_id, finding_id, decision, (note or "").strip() or None),
        )


def _set_status(conn: UserConn, org_id: UUID, report_id: UUID, status: str) -> None:
    _require_staff(conn, org_id)
    with _gate():
        cur = conn.execute(
            "update public.reports set status = %s where org_id = %s and id = %s",
            (status, org_id, report_id),
        )
    if cur.rowcount == 0:
        raise GateError("not_found")


@contextmanager
def _gate() -> Iterator[None]:
    try:
        yield
    except pg_errors.CheckViolation as e:
        code = gate_code(e)
        if code is None:
            raise
        raise GateError(code) from e
