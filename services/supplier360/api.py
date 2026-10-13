"""Supplier 360 public interface (M4): build a dossier (refresh registry + screen), read it,
decide screening hits, re-screen stale suppliers, per-org risk weights.

Runs as the signed-in user under RLS. All sources are SAMPLE adapters until real access exists
(docs/compliance/data-sources.md); every cached row and screening carries a `sample` flag.
A hit never blocks anything: a human confirms or dismisses it with a reason code.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from psycopg import errors as pg_errors
from psycopg.types.json import Jsonb

from connectors.registries.sample import SampleRegistry
from services.gateway.db import UserConn
from services.supplier360 import dossier as d
from services.supplier360.registry import refresh
from services.supplier360.risk import WEIGHTS, weights_for
from services.supplier360.screening import Sources, screen

REASONS = {
    "confirmed": ("same_identifiers", "same_context", "other"),
    "dismissed": (
        "different_identifiers",
        "different_birth_year",
        "different_country",
        "different_entity_type",
        "name_only_similarity",
        "other",
    ),
}


# One instance per process: the sample adapters read their fixtures once (code review: a new
# instance per call defeated the screening cache and grew it without bound).
_REGISTRY = SampleRegistry()
_SOURCES = Sources()


class Unresolved(Exception):
    """The supplier has no BIN: it is never screened as if resolved (CONTEXT: Supplier)."""


@dataclass
class Built:
    party_id: UUID | None
    degraded: list[dict[str, Any]] = field(default_factory=list)
    truncated: bool = False
    screenings: int = 0
    possible_matches: int = 0


def _supplier(conn: UserConn, org_id: UUID, supplier_id: UUID) -> dict[str, Any]:
    row = conn.execute(
        "select id, name, bin from public.suppliers where org_id = %s and id = %s",
        (org_id, supplier_id),
    ).fetchone()
    if row is None:
        raise LookupError("supplier not found")
    return dict(row)


def _same_bin(conn: UserConn, org_id: UUID, sup: dict[str, Any]) -> list[UUID]:
    rows = conn.execute(
        """select id from public.suppliers where org_id = %s and merged_into is null
           and (id = %s or (bin is not null and bin = %s))""",
        (org_id, sup["id"], sup["bin"]),
    ).fetchall()
    return [r["id"] for r in rows]


def build(
    conn: UserConn,
    org_id: UUID,
    supplier_id: UUID,
    trigger: str = "manual",
    registry: SampleRegistry | None = None,
    sources: Sources | None = None,
    bin_: str | None = None,
) -> Built:
    """bin_ overrides the supplier's BIN (onboarding: the BIN the supplier declared and a
    human approved)."""
    sup = _supplier(conn, org_id, supplier_id)
    bin_ = bin_ or sup["bin"]
    if not bin_:
        raise Unresolved
    r = refresh(conn, org_id, bin_, registry or _REGISTRY)
    out = Built(r.party_id, r.degraded, r.truncated)
    root_id = r.party_id or _root_id(conn, org_id, bin_)
    if root_id is None:
        return out  # registry down/unknown and nothing cached: nothing to screen
    nodes, _ = d.graph(conn, org_id, root_id)
    root = next(n for n in nodes if n["id"] == root_id)
    same = _same_bin(conn, org_id, {**sup, "bin": bin_})
    s = screen(conn, org_id, same, nodes, root, trigger, sources or _SOURCES)
    out.screenings, out.possible_matches = s.screenings, s.possible_matches
    return out


def _root_id(conn: UserConn, org_id: UUID, bin_: str) -> UUID | None:
    row = conn.execute(
        """select id from public.parties where org_id = %s and kind = 'company' and bin = %s
           order by fetched_at desc limit 1""",
        (org_id, bin_),
    ).fetchone()
    return None if row is None else UUID(str(row["id"]))


def _view(conn: UserConn, org_id: UUID, sup: dict[str, Any]) -> dict[str, Any]:
    root_id = _root_id(conn, org_id, sup["bin"]) if sup["bin"] else None
    same = _same_bin(conn, org_id, sup)
    out: dict[str, Any] = {
        "supplier": sup,
        "resolved": bool(sup["bin"]),
        "built": root_id is not None,
    }
    out["spend"] = d.spend(conn, org_id, same)
    if root_id is None:
        out.update(company=None, nodes=[], edges=[], screenings=[], items=[], risk=None)
        return out
    nodes, edges = d.graph(conn, org_id, root_id)
    root = next(n for n in nodes if n["id"] == root_id)
    party_runs = d.screenings(conn, org_id, "party_id", [n["id"] for n in nodes])
    item_ids = [
        r["item_id"]
        for r in conn.execute(
            """select distinct item_id from public.purchase_lines
           where org_id = %s and supplier_id = any(%s) and item_id is not null""",
            (org_id, same),
        ).fetchall()
    ]
    line_ids = [
        r["id"]
        for r in conn.execute(
            """select id from public.purchase_lines
               where org_id = %s and supplier_id = any(%s) and item_id is null""",
            (org_id, same),
        ).fetchall()
    ]
    item_runs = d.screenings(conn, org_id, "item_id", item_ids) + d.screenings(
        conn, org_id, "purchase_line_id", line_ids
    )
    sig, known = d.signals(root, nodes, edges, party_runs, item_runs, datetime.now(UTC).date())
    cfg = conn.execute(
        "select risk_config from public.organizations where id = %s", (org_id,)
    ).fetchone()
    risk = d.assess_supplier(cfg["risk_config"] if cfg else None, sig, known)
    out.update(
        company=root,
        nodes=nodes,
        edges=edges,
        screenings=party_runs,
        items=item_runs,
        risk={
            "score": risk.score,
            "verdict": risk.verdict,
            "factors": [f.__dict__ | {"points": f.points} for f in risk.factors],
            "top": [f.code for f in risk.top],
        },
    )
    return out


def dossier(conn: UserConn, org_id: UUID, supplier_id: UUID) -> dict[str, Any]:
    out = _view(conn, org_id, _supplier(conn, org_id, supplier_id))
    persons = sum(n["kind"] == "person" for n in out["nodes"])
    # Personal data access is logged (M4 Part E): who opened which dossier, how many persons.
    conn.execute(
        "select private.append_audit(%s, 'dossier.viewed', 'suppliers', %s, %s)",
        (org_id, supplier_id, Jsonb({"persons": persons})),
    )
    return out


def suppliers(conn: UserConn, org_id: UUID) -> list[dict[str, Any]]:
    """Every unmerged supplier with its verdict (None until a dossier was built).

    ponytail: one dossier view per supplier (~8 queries each); fine for tens of suppliers.
    Upgrade path (D36): persist a verdict snapshot on build/decision and list it set-based.
    """
    rows = conn.execute(
        """select distinct on (coalesce(bin, id::text)) id, name, bin from public.suppliers
           where org_id = %s and merged_into is null
           order by coalesce(bin, id::text), created_at""",
        (org_id,),
    ).fetchall()
    out = []
    for r in rows:
        v = _view(conn, org_id, dict(r))
        risk = v["risk"] or {}
        out.append(
            {
                **dict(r),
                "built": v["built"],
                "verdict": risk.get("verdict"),
                "score": risk.get("score"),
                "top": risk.get("top", []),
                "spend_kzt": v["spend"]["total_kzt"],
                "sample": bool(v["company"] and v["company"]["sample"]),
            }
        )
    return sorted(out, key=lambda x: -(x["spend_kzt"] or 0))


def decide(
    conn: UserConn, org_id: UUID, hit_id: UUID, decision: str, reason_code: str, note: str | None
) -> None:
    if reason_code not in REASONS.get(decision, ()):
        raise ValueError("invalid_reason")
    if reason_code == "other" and not (note or "").strip():
        raise ValueError("note_required")
    try:
        conn.execute(
            """insert into public.hit_decisions (org_id, hit_id, decision, reason_code, note)
               values (%s, %s, %s, %s, %s)""",
            (org_id, hit_id, decision, reason_code, (note or "").strip() or None),
        )
    except pg_errors.ForeignKeyViolation:
        raise LookupError("hit not found") from None


def rescreen_due(conn: UserConn, org_id: UUID, max_age_days: int = d.STALE_DAYS) -> int:
    """Re-screen every resolved supplier whose last sanctions screening is older than the limit
    (or missing). Returns how many were re-screened. Scheduling it is deployment work (D27)."""
    cutoff = datetime.now(UTC) - timedelta(days=max_age_days)
    due = conn.execute(
        """select distinct on (s.bin) s.id from public.suppliers s
           left join public.parties p
             on p.org_id = s.org_id and p.kind = 'company' and p.bin = s.bin
           where s.org_id = %s and s.merged_into is null and s.bin is not null
             and coalesce((select max(x.checked_at) from public.screenings x
                           where x.party_id = p.id and x.list_source = 'opensanctions'),
                          '-infinity') < %s
           order by s.bin, s.created_at""",
        (org_id, cutoff),
    ).fetchall()
    for row in due:
        build(conn, org_id, row["id"], trigger="schedule")
    return len(due)


def risk_weights(conn: UserConn, org_id: UUID) -> dict[str, Any]:
    row = conn.execute(
        "select risk_config from public.organizations where id = %s", (org_id,)
    ).fetchone()
    return {"defaults": WEIGHTS, "weights": weights_for(row["risk_config"] if row else None)}


def set_risk_weights(conn: UserConn, org_id: UUID, weights: dict[str, int]) -> dict[str, Any]:
    clean = {k: max(0, min(100, int(v))) for k, v in weights.items() if k in WEIGHTS}
    updated = conn.execute(
        "update public.organizations set risk_config = %s where id = %s returning id",
        (Jsonb(clean), org_id),
    ).fetchone()
    if updated is None:
        raise PermissionError("admins only")
    tenancy_audit(conn, org_id, clean)
    return risk_weights(conn, org_id)


def tenancy_audit(conn: UserConn, org_id: UUID, weights: dict[str, int]) -> None:
    conn.execute(
        "select private.append_audit(%s, 'risk.weights_changed', 'organizations', %s, %s)",
        (org_id, org_id, Jsonb(weights)),
    )


# ---------------------------------------------------------------- onboarding (public surface)
from services.supplier360 import onboarding as _ob  # noqa: E402

OnboardingRejected = _ob.Rejected
invite_supplier = _ob.invite
onboarding_cases = _ob.cases
onboarding_case = _ob.case
save_onboarding_details = _ob.save_details
add_onboarding_document = _ob.add_document
onboarding_document = _ob.document
MAX_DOC_BYTES = _ob.MAX_DOC_BYTES
submit_onboarding = _ob.submit


def decide_onboarding(
    conn: UserConn, org_id: UUID, case_id: UUID, decision: str, note: str | None
) -> Built | None:
    """Approve / reject / return. An approval screens the company the supplier declared (its
    BIN, approved by a human), whatever BIN the supplier record had; the review shows a
    mismatch before anyone approves."""
    approved = _ob.decide(conn, org_id, case_id, decision, note)
    if approved is None:
        return None
    supplier_id, case_bin = approved
    # Fill an empty supplier BIN with the approved one (RLS: only writers of supplier data can).
    conn.execute(
        "update public.suppliers set bin = %s where org_id = %s and id = %s and bin is null",
        (case_bin, org_id, supplier_id),
    )
    try:
        return build(conn, org_id, UUID(supplier_id), trigger="onboarding", bin_=case_bin)
    except Unresolved:
        return None


def risk_scores(conn: UserConn, org_id: UUID, supplier_ids: list[UUID]) -> dict[UUID, int | None]:
    """Latest rules-based risk score per supplier (None until its dossier was built). No audit:
    no personal data leaves this function, only the score."""
    out: dict[UUID, int | None] = {}
    for sid in dict.fromkeys(supplier_ids):
        try:
            v = _view(conn, org_id, _supplier(conn, org_id, sid))
        except LookupError:
            out[sid] = None
            continue
        out[sid] = v["risk"]["score"] if v["risk"] else None
    return out
