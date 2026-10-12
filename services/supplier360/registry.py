"""Refresh the cached registry facts and ownership chain of one supplier (runs as the user, RLS)."""

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from connectors._contract.contract import SourceRecord
from connectors.outage import SourceUnavailable
from connectors.registries.sample import SampleRegistry
from services.gateway.db import UserConn

SAMPLE = "synthetic sample"  # licence prefix of every sample adapter: rows are badged in the UI
MAX_DEPTH = 6  # owner chains deeper than this are cut and flagged


@dataclass
class Refresh:
    party_id: UUID | None = None
    degraded: list[dict[str, Any]] = field(default_factory=list)
    truncated: bool = False


def _upsert(conn: UserConn, org_id: UUID, rec: SourceRecord, fields: dict[str, Any]) -> UUID:
    row = conn.execute(
        """insert into public.parties (org_id, kind, name, country, bin, birth_year,
             registry_status, registered_on, source_id, source_ref, fetched_at, licence, sample)
           values (%(org)s, %(kind)s, %(name)s, %(country)s, %(bin)s, %(birth_year)s,
             %(status)s, %(registered_on)s, %(source)s, %(ref)s, %(fetched)s, %(licence)s,
             %(sample)s)
           on conflict (org_id, source_id, source_ref) do update set
             name = excluded.name, country = excluded.country, bin = excluded.bin,
             birth_year = excluded.birth_year, registry_status = excluded.registry_status,
             registered_on = excluded.registered_on, fetched_at = excluded.fetched_at,
             licence = excluded.licence, sample = excluded.sample
           returning id""",
        {
            "org": org_id,
            "source": rec.source_id,
            "fetched": rec.fetched_at,
            "licence": rec.licence,
            "sample": rec.licence.startswith(SAMPLE),
            "bin": None,
            "birth_year": None,
            "status": None,
            "registered_on": None,
            "country": None,
            **fields,
        },
    ).fetchone()
    assert row is not None
    return UUID(str(row["id"]))


def _company(conn: UserConn, org_id: UUID, rec: SourceRecord) -> UUID:
    p = rec.payload
    return _upsert(
        conn,
        org_id,
        rec,
        {
            "kind": "company",
            "name": p["name"],
            "country": p["country"],
            "bin": p["bin"],
            "status": p["status"],
            "registered_on": p["registered_on"],
            "ref": p["bin"],
        },
    )


def _walk(
    conn: UserConn,
    org_id: UUID,
    registry: SampleRegistry,
    rec: SourceRecord,
    out: Refresh,
    depth: int,
    seen: set[str],
) -> UUID:
    company_id = _company(conn, org_id, rec)
    seen.add(str(rec.payload["bin"]))
    kept: set[tuple[str, str]] = set()
    complete = True
    for o in rec.payload["owners"]:
        owner_id = _owner(conn, org_id, registry, rec, o, out, depth, seen)
        if owner_id is None:
            complete = False  # an owner could not be fetched: keep what we had for it
            continue
        kept.add((str(owner_id), o["role"]))
        conn.execute(
            """insert into public.ownership_links (org_id, owner_id, owned_id, role, share_pct,
                 source_id, fetched_at, licence, sample)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (org_id, owner_id, owned_id, role) do update set
                 share_pct = excluded.share_pct, fetched_at = excluded.fetched_at,
                 licence = excluded.licence, sample = excluded.sample""",
            (
                org_id,
                owner_id,
                company_id,
                o["role"],
                o.get("share_pct"),
                rec.source_id,
                rec.fetched_at,
                rec.licence,
                rec.licence.startswith(SAMPLE),
            ),
        )
    # Remove links the registry no longer lists, but only after a complete fetch: an outage
    # must never erase cached ownership (and the sanctions hits reached through it).
    if complete:
        old = conn.execute(
            """select id, owner_id, role from public.ownership_links
               where org_id = %s and owned_id = %s and source_id = %s""",
            (org_id, company_id, rec.source_id),
        ).fetchall()
        gone = [r["id"] for r in old if (str(r["owner_id"]), r["role"]) not in kept]
        if gone:
            conn.execute("delete from public.ownership_links where id = any(%s)", (gone,))
    return company_id


def _owner(
    conn: UserConn,
    org_id: UUID,
    registry: SampleRegistry,
    parent: SourceRecord,
    o: dict[str, Any],
    out: Refresh,
    depth: int,
    seen: set[str],
) -> UUID | None:
    if o["kind"] == "person":
        return _upsert(
            conn,
            org_id,
            parent,
            {
                "kind": "person",
                "name": o["name"],
                "country": o.get("country"),
                "birth_year": o.get("birth_year"),
                "ref": o["ref"],
            },
        )
    if o["bin"] in seen:  # cycle or shared parent: link to the cached party
        row = conn.execute(
            """select id from public.parties
               where org_id = %s and source_ref = %s and source_id = %s""",
            (org_id, o["bin"], parent.source_id),
        ).fetchone()
        return UUID(str(row["id"])) if row else None
    if depth >= MAX_DEPTH:
        out.truncated = True
        return None
    try:
        rec = registry.company(o["bin"])
    except SourceUnavailable as e:
        out.degraded.append({"source_id": e.source_id, "reason": e.reason, "bin": o["bin"]})
        return None
    if rec is None:
        out.degraded.append(
            {"source_id": registry.source_id, "reason": "not_found", "bin": o["bin"]}
        )
        return None
    return _walk(conn, org_id, registry, rec, out, depth + 1, seen)


def refresh(conn: UserConn, org_id: UUID, bin_: str, registry: SampleRegistry) -> Refresh:
    out = Refresh()
    try:
        rec = registry.company(bin_)
    except SourceUnavailable as e:
        out.degraded.append({"source_id": e.source_id, "reason": e.reason, "bin": bin_})
        return out
    if rec is None:
        out.degraded.append({"source_id": registry.source_id, "reason": "not_found", "bin": bin_})
        return out
    out.party_id = _walk(conn, org_id, registry, rec, out, 0, set())
    return out
