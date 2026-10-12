"""Dossier read model: registry facts, ownership graph, latest screenings with decisions, spend
and the rules-first risk verdict. Every fact carries its source and date (CONTEXT: Dossier)."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from psycopg import sql

from services.gateway.db import UserConn
from services.supplier360.risk import Risk, assess, weights_for

STALE_DAYS = 30
SUBJECTS = ("party_id", "item_id")
GRAPH_DEPTH = 8


def graph(
    conn: UserConn, org_id: UUID, root: UUID
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    nodes = conn.execute(
        """with recursive chain(id, depth) as (
             select %(root)s::uuid, 0
             union
             select l.owner_id, c.depth + 1 from public.ownership_links l
             join chain c on l.owned_id = c.id
             where l.org_id = %(org)s and c.depth < %(max)s)
           select p.id, p.kind, p.name, p.country, p.bin, p.birth_year, p.registry_status,
                  p.registered_on, p.source_id, p.source_ref, p.fetched_at, p.licence, p.sample,
                  min(c.depth) as depth
           from chain c join public.parties p on p.id = c.id and p.org_id = %(org)s
           group by p.id order by depth, p.kind, p.name""",
        {"root": root, "org": org_id, "max": GRAPH_DEPTH},
    ).fetchall()
    ids = [n["id"] for n in nodes]
    edges = conn.execute(
        """select owner_id, owned_id, role, share_pct, source_id, fetched_at, sample
           from public.ownership_links where org_id = %s and owned_id = any(%s)
           order by owned_id, role, share_pct desc nulls last""",
        (org_id, ids),
    ).fetchall()
    return [dict(n) for n in nodes], [dict(e) for e in edges]


def screenings(conn: UserConn, org_id: UUID, column: str, ids: list[UUID]) -> list[dict[str, Any]]:
    """Latest screening per (subject, list) with its hits and each hit's latest decision."""
    if column not in SUBJECTS:
        raise ValueError("unknown subject column")
    col = sql.Identifier("s", column)
    runs = conn.execute(
        sql.SQL(
            """select distinct on ({col}, s.list_source) s.id, {col} as subject_id,
                 s.list_source, s.list_version, s.trigger, s.result, s.sample, s.checked_at,
                 s.checked_by = auth.uid() as checked_by_me
               from public.screenings s where s.org_id = %s and {col} = any(%s)
               order by {col}, s.list_source, s.checked_at desc"""
        ).format(col=col),
        (org_id, ids),
    ).fetchall()
    hits = conn.execute(
        """select h.id, h.screening_id, h.entry_id, h.entry_name, h.entry_topics, h.score,
                  h.explanation, d.decision, d.reason_code, d.note, d.created_at as decided_at,
                  d.decided_by = auth.uid() as decided_by_me,
                  private.staff_name(d.decided_by) as decided_by_staff
           from public.screening_hits h
           left join lateral (select * from public.hit_decisions x where x.hit_id = h.id
                              order by x.created_at desc limit 1) d on true
           where h.org_id = %s and h.screening_id = any(%s) order by h.score desc""",
        (org_id, [r["id"] for r in runs]),
    ).fetchall()
    by_run: dict[UUID, list[dict[str, Any]]] = {}
    for h in hits:
        by_run.setdefault(h["screening_id"], []).append(dict(h))
    return [{**dict(r), "hits": by_run.get(r["id"], [])} for r in runs]


def spend(conn: UserConn, org_id: UUID, supplier_ids: list[UUID]) -> dict[str, Any]:
    row = conn.execute(
        """select count(*)::int as lines,
                  coalesce(sum(quantity * unit_price_kzt), 0) as total_kzt,
                  count(*) filter (where quantity is null or unit_price_kzt is null)::int
                    as unpriced,
                  min(purchased_on) as first_on, max(purchased_on) as last_on
           from public.purchase_lines where org_id = %s and supplier_id = any(%s)""",
        (org_id, supplier_ids),
    ).fetchone()
    sources = conn.execute(
        """select pl.id, f.name as file_name, pl.source_row, pl.item_text, pl.supplier_text,
                  pl.quantity, pl.unit_price_kzt, pl.purchased_on
           from public.purchase_lines pl
           join public.files f on f.id = pl.file_id and f.org_id = pl.org_id
           where pl.org_id = %s and pl.supplier_id = any(%s)
           order by pl.purchased_on desc nulls last, pl.source_row limit 200""",
        (org_id, supplier_ids),
    ).fetchall()
    findings = conn.execute(
        """select id, type, saving_estimate, currency, report_id from public.findings
           where org_id = %s and supplier_id = any(%s) order by saving_estimate desc""",
        (org_id, supplier_ids),
    ).fetchall()
    assert row is not None
    return {
        **dict(row),
        "evidence": {
            "method": "sum(quantity * unit_price_kzt) over the supplier's purchase lines",
            "sources": [dict(r) for r in sources],
        },
        "findings": [dict(f) for f in findings],
    }


def _open(h: dict[str, Any]) -> bool:
    return h["decision"] is None


def signals(
    root: dict[str, Any],
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    party_runs: list[dict[str, Any]],
    item_runs: list[dict[str, Any]],
    today: date,
) -> tuple[dict[str, dict[str, Any] | None], bool]:
    names = {n["id"]: n["name"] for n in nodes}
    s: dict[str, dict[str, Any] | None] = {}
    watch = [(r, h) for r in party_runs if r["list_source"] == "opensanctions" for h in r["hits"]]
    sanction = [(r, h) for r, h in watch if "sanction" in h["entry_topics"]]
    # Enforcement / crime lists are not sanctions: their own factor, open or confirmed.
    other = [
        (r, h)
        for r, h in watch
        if "sanction" not in h["entry_topics"]
        and set(h["entry_topics"]) - {"role.pep"}
        and h["decision"] != "dismissed"
    ]
    pep = [
        (r, h) for r, h in watch if "role.pep" in h["entry_topics"] and h["decision"] != "dismissed"
    ]

    def first(pairs: list[tuple[dict[str, Any], dict[str, Any]]]) -> dict[str, Any] | None:
        return (
            {
                "party": names.get(pairs[0][0]["subject_id"]),
                "entry": pairs[0][1]["entry_name"],
                "hit_id": str(pairs[0][1]["id"]),
                "count": len(pairs),
            }
            if pairs
            else None
        )

    s["sanctions_confirmed"] = first([p for p in sanction if p[1]["decision"] == "confirmed"])
    s["sanctions_open"] = first([p for p in sanction if _open(p[1])])
    s["pep_related"] = first(pep)
    s["watchlist_match"] = first(other)
    rnu = [
        h
        for r in party_runs
        if r["list_source"] == "goszakup_rnu"
        for h in r["hits"]
        if h["decision"] != "dismissed"
    ]
    s["unreliable_supplier"] = {"until": rnu[0]["explanation"].get("until")} if rnu else None
    status = root.get("registry_status")
    s["not_active"] = {"status": status} if status and status != "active" else None
    reg = root.get("registered_on")
    s["young_company"] = (
        {"registered_on": str(reg)} if reg and reg > today - timedelta(days=730) else None
    )
    foreign = [
        n
        for n in nodes
        if n["kind"] == "company" and n["depth"] > 0 and n["country"] not in (None, "KZ")
    ]
    s["foreign_owner"] = (
        {"party": foreign[0]["name"], "country": foreign[0]["country"]} if foreign else None
    )
    has_bo = any(e["role"] == "beneficial_owner" for e in edges)
    s["no_beneficial_owner"] = None if has_bo else {}
    du = [h for r in item_runs for h in r["hits"] if h["decision"] != "dismissed"]
    s["dual_use_goods"] = {"entry": du[0]["entry_name"], "count": len(du)} if du else None
    root_runs = [
        r
        for r in party_runs
        if r["subject_id"] == root["id"] and r["list_source"] == "opensanctions"
    ]
    last = root_runs[0]["checked_at"] if root_runs else None
    stale = last is None or last < datetime.now(UTC) - timedelta(days=STALE_DAYS)
    s["screening_stale"] = {"last": last.isoformat() if last else None} if stale else None
    return s, last is not None


def assess_supplier(
    risk_config: dict[str, Any] | None, sig: dict[str, dict[str, Any] | None], known: bool
) -> Risk:
    return assess(sig, weights_for(risk_config), known=known)


def money(value: Decimal | None) -> str | None:
    return None if value is None else str(value)
