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
) -> Built:
    sup = _supplier(conn, org_id, supplier_id)
    if not sup["bin"]:
        raise Unresolved
    r = refresh(conn, org_id, sup["bin"], registry or SampleRegistry())
    out = Built(r.party_id, r.degraded, r.truncated)
    root_id = r.party_id or _root_id(conn, org_id, sup["bin"])
    if root_id is None:
        return out  # registry down/unknown and nothing cached: nothing to screen
    nodes, _ = d.graph(conn, org_id, root_id)
    root = next(n for n in nodes if n["id"] == root_id)
    s = screen(conn, org_id, supplier_id, nodes, root, trigger, sources or Sources())
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
    item_runs = d.screenings(conn, org_id, "item_id", item_ids)
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
    """Every unmerged supplier with its verdict (None until a dossier was built)."""
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
                "sample": v["built"],
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
        """select s.id from public.suppliers s
           join public.parties p on p.org_id = s.org_id and p.kind = 'company' and p.bin = s.bin
           where s.org_id = %s and s.merged_into is null and s.bin is not null
             and coalesce((select max(x.checked_at) from public.screenings x
                           where x.party_id = p.id and x.list_source = 'opensanctions'),
                          '-infinity') < %s""",
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
