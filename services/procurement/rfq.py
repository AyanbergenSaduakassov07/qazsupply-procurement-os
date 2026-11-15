"""RFQ workflow over the database state machine (migration 20261014000000). Runs as the user.

Nothing is sent or awarded automatically: approval, "sent", offer confirmation by a buyer and the
decision are each a named human's action, and the database refuses the shortcuts.
"""

import re
from collections.abc import Callable
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from psycopg import errors as pg_errors
from psycopg.types.json import Jsonb

from services.gateway.db import UserConn
from services.procurement.compare import Comparison, compare

ALMATY = ZoneInfo("Asia/Almaty")
RateOn = Callable[[str, date], tuple[Decimal, date] | None]


class Rejected(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _rule(e: Exception) -> Rejected:
    m = re.search(r"rfq:([a-z_]+)", str(e))
    return Rejected(m.group(1) if m else "invalid")


def _run(fn: Callable[[], Any]) -> Any:
    try:
        return fn()
    except (pg_errors.CheckViolation, pg_errors.RaiseException) as e:
        raise _rule(e) from None
    except pg_errors.UniqueViolation:
        raise Rejected("duplicate") from None  # same supplier twice, offer already confirmed
    except pg_errors.ForeignKeyViolation:
        raise LookupError("not found") from None  # another org's supplier, item or offer


def create(
    conn: UserConn,
    org_id: UUID,
    title: str,
    deadline: date | None,
    spec_text: str,
    items: list[dict[str, Any]],
    terms: dict[str, Any],
) -> UUID:
    row = _run(
        lambda: conn.execute(
            "insert into public.rfqs (org_id, title, deadline) values (%s, %s, %s) returning id",
            (org_id, title, deadline),
        ).fetchone()
    )
    rfq_id = UUID(str(row["id"]))
    _run(
        lambda: conn.execute(
            """insert into public.rfq_versions (org_id, rfq_id, version, spec_text, items, terms)
           values (%s, %s, 1, %s, %s, %s)""",
            (org_id, rfq_id, spec_text, Jsonb(items), Jsonb(terms)),
        )
    )
    return rfq_id


def new_version(
    conn: UserConn,
    org_id: UUID,
    rfq_id: UUID,
    spec_text: str,
    items: list[dict[str, Any]],
    terms: dict[str, Any],
) -> int:
    cur = conn.execute(
        "select current_version from public.rfqs where org_id = %s and id = %s", (org_id, rfq_id)
    ).fetchone()
    if cur is None:
        raise LookupError("rfq not found")
    version = int(cur["current_version"]) + 1
    _run(
        lambda: conn.execute(
            """insert into public.rfq_versions (org_id, rfq_id, version, spec_text, items, terms)
           values (%s, %s, %s, %s, %s, %s)""",
            (org_id, rfq_id, version, spec_text, Jsonb(items), Jsonb(terms)),
        )
    )
    return version


def _status(conn: UserConn, org_id: UUID, rfq_id: UUID, status: str) -> None:
    row = _run(
        lambda: conn.execute(
            "update public.rfqs set status = %s where org_id = %s and id = %s returning id",
            (status, org_id, rfq_id),
        ).fetchone()
    )
    if row is None:
        raise LookupError("rfq not found")


def approve(conn: UserConn, org_id: UUID, rfq_id: UUID, note: str | None) -> None:
    cur = conn.execute(
        "select current_version from public.rfqs where org_id = %s and id = %s", (org_id, rfq_id)
    ).fetchone()
    if cur is None:
        raise LookupError("rfq not found")
    _run(
        lambda: conn.execute(
            """insert into public.rfq_approvals (org_id, rfq_id, version, note)
               values (%s, %s, %s, %s)""",
            (org_id, rfq_id, cur["current_version"], note),
        )
    )
    _status(conn, org_id, rfq_id, "approved")


def invite(
    conn: UserConn, org_id: UUID, rfq_id: UUID, supplier_id: UUID, channel: str, email: str | None
) -> UUID:
    user = None
    if channel == "portal":
        row = conn.execute(
            "select private.supplier_member_by_email(%s, %s) as uid", (org_id, email or "")
        ).fetchone()
        user = row["uid"] if row else None
        if user is None:
            raise Rejected("not_a_supplier_member")
    row = _run(
        lambda: conn.execute(
            """insert into public.rfq_invites (org_id, rfq_id, supplier_id, supplier_user_id,
                 channel)
           values (%s, %s, %s, %s, %s) returning id""",
            (org_id, rfq_id, supplier_id, user, channel),
        ).fetchone()
    )
    return UUID(str(row["id"]))


def mark_sent(conn: UserConn, org_id: UUID, invite_id: UUID) -> None:
    """A human records that they sent the approved RFQ to this supplier (or gave portal access)."""
    row = _run(
        lambda: conn.execute(
            """update public.rfq_invites set sent_at = now() where org_id = %s and id = %s
           returning rfq_id""",
            (org_id, invite_id),
        ).fetchone()
    )
    if row is None:
        raise LookupError("invite not found")
    conn.execute(
        "update public.rfqs set status = 'sent' where id = %s and status = 'approved'",
        (row["rfq_id"],),
    )


def close(conn: UserConn, org_id: UUID, rfq_id: UUID) -> None:
    _status(conn, org_id, rfq_id, "closed")


def cancel(conn: UserConn, org_id: UUID, rfq_id: UUID) -> None:
    _status(conn, org_id, rfq_id, "cancelled")


def add_offer(
    conn: UserConn, org_id: UUID, rfq_id: UUID, invite_id: UUID, o: dict[str, Any]
) -> UUID:
    row = _run(
        lambda: conn.execute(
            """insert into public.offers (org_id, rfq_id, invite_id, rfq_version, source, currency,
             payment_days, lead_time_days, valid_until, incoterms, lines)
           values (%s, %s, %s, 0, %s, %s, %s, %s, %s, %s, %s) returning id""",
            (
                org_id,
                rfq_id,
                invite_id,
                o["source"],
                o["currency"],
                o.get("payment_days"),
                o.get("lead_time_days"),
                o.get("valid_until"),
                o.get("incoterms"),
                Jsonb(o["lines"]),
            ),
        ).fetchone()
    )
    if row is None:
        raise LookupError("rfq not found")
    return UUID(str(row["id"]))


def confirm_offer(conn: UserConn, org_id: UUID, offer_id: UUID, note: str | None) -> None:
    _run(
        lambda: conn.execute(
            """insert into public.offer_confirmations (org_id, offer_id, by_supplier, note)
           values (%s, %s, false, %s)""",
            (org_id, offer_id, note),
        )
    )


def set_weights(conn: UserConn, org_id: UUID, rfq_id: UUID, weights: dict[str, float]) -> None:
    row = _run(
        lambda: conn.execute(
            "update public.rfqs set weights = %s where org_id = %s and id = %s returning id",
            (Jsonb({k: float(v) for k, v in weights.items()}), org_id, rfq_id),
        ).fetchone()
    )
    if row is None:
        raise LookupError("rfq not found")


def _latest_offers(conn: UserConn, org_id: UUID, rfq_id: UUID) -> list[dict[str, Any]]:
    """The newest offer per invite (a newer one supersedes; history stays in the table)."""
    rows = conn.execute(
        """select distinct on (o.invite_id) o.id, o.invite_id, o.source, o.currency, o.payment_days,
             o.lead_time_days, o.valid_until, o.incoterms, o.lines, o.created_at, o.rfq_version,
             i.supplier_id, s.name as supplier_name,
             c.id is not null as confirmed, c.by_supplier, c.note as confirmation_note
           from public.offers o
           join public.rfq_invites i on i.id = o.invite_id
           left join public.suppliers s on s.id = i.supplier_id
           left join public.offer_confirmations c on c.offer_id = o.id
           where o.org_id = %s and o.rfq_id = %s
           order by o.invite_id, o.created_at desc""",
        (org_id, rfq_id),
    ).fetchall()
    return [dict(r) for r in rows]


def comparison(
    conn: UserConn,
    org_id: UUID,
    rfq_id: UUID,
    rate_on: RateOn,
    risk: Callable[[list[UUID]], dict[UUID, int | None]],
) -> Comparison:
    rfq = conn.execute(
        """select r.weights, v.items from public.rfqs r
           join public.rfq_versions v on v.rfq_id = r.id and v.version = r.current_version
           where r.org_id = %s and r.id = %s""",
        (org_id, rfq_id),
    ).fetchone()
    if rfq is None:
        raise LookupError("rfq not found")
    offers = _latest_offers(conn, org_id, rfq_id)
    scores = risk([o["supplier_id"] for o in offers])
    # The offer's calendar day in Kazakhstan, not in the database's UTC.
    day = {str(o["id"]): o["created_at"].astimezone(ALMATY).date() for o in offers}
    rows = [
        {
            "id": o["id"],
            "supplier": o["supplier_name"] or str(o["supplier_id"]),
            "confirmed": o["confirmed"],
            "currency": o["currency"],
            "lines": o["lines"],
            "lead_time_days": o["lead_time_days"],
            "payment_days": o["payment_days"],
            "risk_score": scores.get(o["supplier_id"]),
        }
        for o in offers
    ]
    return compare(
        list(rfq["items"]), rows, rfq["weights"], lambda cur, oid: rate_on(cur, day[oid])
    )


def decide(
    conn: UserConn, org_id: UUID, rfq_id: UUID, offer_id: UUID, reason: str, c: Comparison
) -> UUID:
    alternatives = [
        {
            "offer_id": r.offer_id,
            "supplier": r.supplier,
            "total_kzt": _s(r.total_kzt),
            "lead_time": r.lead_time,
            "payment": r.payment,
            "risk": r.risk,
            "score": _s(r.score),
            "excluded": r.excluded,
        }
        for r in c.rows
    ]
    weights = {k: str(v) for k, v in c.weights.items()}
    row = _run(
        lambda: conn.execute(
            """insert into public.decisions (org_id, rfq_id, offer_id, reason, alternatives,
                 weights) values (%s, %s, %s, %s, %s, %s) returning id""",
            (org_id, rfq_id, offer_id, reason, Jsonb(alternatives), Jsonb(weights)),
        ).fetchone()
    )
    _status(conn, org_id, rfq_id, "decided")
    return UUID(str(row["id"]))


def _s(v: Decimal | None) -> str | None:
    return None if v is None else str(v)
