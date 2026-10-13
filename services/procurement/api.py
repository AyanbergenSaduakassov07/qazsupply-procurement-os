"""Procurement OS public interface (M5): ТЗ check, RFQ workflow, comparison, decisions, catalogue.

Runs as the signed-in user under RLS; the database enforces the RFQ state machine. Nothing is
sent or awarded automatically (no tool, no model, no background job does either).
"""

import os
from datetime import date, timedelta
from decimal import Decimal
from functools import cache
from pathlib import Path
from typing import Any
from uuid import UUID

from connectors.fx.nbk import NbkFx
from services.gateway.db import UserConn
from services.procurement import catalogue, rfq
from services.procurement.compare import Comparison
from services.procurement.spec_check import Result, check
from services.supplier360 import api as s360

Rejected = rfq.Rejected
create_rfq = rfq.create
new_version = rfq.new_version
approve = rfq.approve
invite = rfq.invite
mark_sent = rfq.mark_sent
close = rfq.close
cancel = rfq.cancel
add_offer = rfq.add_offer
confirm_offer = rfq.confirm_offer
set_weights = rfq.set_weights
add_entry = catalogue.add
search_catalogue = catalogue.search
price_history = catalogue.price_history
analogs = catalogue.analogs
analog_feedback = catalogue.feedback
analog_acceptance = catalogue.acceptance
REMIND_DAYS = 3


def spec_check(text: str) -> Result:
    return check(text)


@cache
def _fx() -> NbkFx:
    # Official National Bank rates, fetched on demand and cached per day (connectors/fx).
    # ponytail: the cache is the connector's fixtures folder; a writable cache dir per deploy
    # (FX_CACHE_DIR) when the API runs on a read-only filesystem.
    cache = os.environ.get("FX_CACHE_DIR")
    return NbkFx(Path(cache), allow_network=True) if cache else NbkFx(allow_network=True)


def nbk_rate(currency: str, on: date) -> tuple[Decimal, date] | None:
    try:
        return _fx().rate(currency, on)
    except (LookupError, OSError, ValueError):
        return None  # shown as "no_fx_rate": the offer is listed, not ranked


# The rate source, swappable in tests (index 0); production: the National Bank.
RATE: list[rfq.RateOn] = [nbk_rate]


def comparison(
    conn: UserConn, org_id: UUID, rfq_id: UUID, rate_on: rfq.RateOn | None = None
) -> Comparison:
    return rfq.comparison(
        conn, org_id, rfq_id, rate_on or RATE[0], lambda ids: s360.risk_scores(conn, org_id, ids)
    )


def decide(
    conn: UserConn,
    org_id: UUID,
    rfq_id: UUID,
    offer_id: UUID,
    reason: str,
    rate_on: rfq.RateOn | None = None,
) -> UUID:
    """A named approver awards, with a reason; the matrix and weights are frozen in the record."""
    c = comparison(conn, org_id, rfq_id, rate_on)
    if str(offer_id) not in {r.offer_id for r in c.rows if r.excluded is None}:
        raise Rejected("offer_not_rankable")
    return rfq.decide(conn, org_id, rfq_id, offer_id, reason, c)


def list_rfqs(conn: UserConn, org_id: UUID) -> list[dict[str, Any]]:
    """RFQs visible to the caller (suppliers: only those sent to them), with due flags."""
    rows = conn.execute(
        """select r.id, r.title, r.status, r.current_version, r.deadline, r.created_at,
             (select count(*) from public.rfq_invites i where i.rfq_id = r.id)::int as invites,
             (select count(distinct o.invite_id) from public.offers o
              where o.rfq_id = r.id)::int as offers
           from public.rfqs r where r.org_id = %s order by r.created_at desc""",
        (org_id,),
    ).fetchall()
    soon = date.today() + timedelta(days=REMIND_DAYS)
    return [
        {
            **dict(r),
            "due_soon": bool(
                r["deadline"] and r["status"] in ("sent", "collecting") and r["deadline"] <= soon
            ),
        }
        for r in rows
    ]


def get_rfq(conn: UserConn, org_id: UUID, rfq_id: UUID) -> dict[str, Any]:
    r = conn.execute(
        """select id, title, status, current_version, deadline, weights, created_at,
             created_by = auth.uid() as mine
           from public.rfqs where org_id = %s and id = %s""",
        (org_id, rfq_id),
    ).fetchone()
    if r is None:
        raise LookupError("rfq not found")
    q = (org_id, rfq_id)
    versions = conn.execute(
        """select version, spec_text, items, terms, created_at from public.rfq_versions
           where org_id = %s and rfq_id = %s order by version""",
        q,
    ).fetchall()
    approvals = conn.execute(
        """select version, note, created_at, private.staff_name(approved_by) as approved_by_staff,
             approved_by = auth.uid() as approved_by_me
           from public.rfq_approvals where org_id = %s and rfq_id = %s order by created_at""",
        q,
    ).fetchall()
    invites = conn.execute(
        """select i.id, i.supplier_id, s.name as supplier_name, i.channel, i.sent_at,
             i.supplier_user_id = auth.uid() as mine
           from public.rfq_invites i left join public.suppliers s on s.id = i.supplier_id
           where i.org_id = %s and i.rfq_id = %s order by i.created_at""",
        q,
    ).fetchall()
    decision = conn.execute(
        """select offer_id, reason, alternatives, weights, created_at,
             private.staff_name(decided_by) as decided_by_staff,
             decided_by = auth.uid() as decided_by_me
           from public.decisions where org_id = %s and rfq_id = %s""",
        q,
    ).fetchone()
    return {
        **dict(r),
        "versions": [dict(v) for v in versions],
        "approvals": [dict(a) for a in approvals],
        "invites": [dict(i) for i in invites],
        "offers": rfq._latest_offers(conn, org_id, rfq_id),
        "decision": dict(decision) if decision else None,
    }
