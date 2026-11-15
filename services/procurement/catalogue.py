"""Catalogue (M5 Part D): entries, forgiving search, price history with sources, analogs.

Search: Postgres trigram similarity on a folded name (ё/е and Kazakh letters folded to Russian
look-alikes) plus attribute filters; empty results explain which filter emptied them.
Analogs: same family of attributes, ranked by how many stated attributes agree; every analog
says what is the same and what differs. Embedding search is deferred (D38).
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from psycopg import sql
from psycopg.types.json import Jsonb

from services.gateway.db import UserConn

FOLD = str.maketrans(
    {
        "ё": "е",
        "ә": "а",
        "ғ": "г",
        "қ": "к",
        "ң": "н",
        "ө": "о",
        "ұ": "у",
        "ү": "у",
        "һ": "х",
        "і": "и",
    }
)
SIMILARITY = 0.2


def fold(text: str) -> str:
    return text.lower().translate(FOLD).strip()


def add(conn: UserConn, org_id: UUID, e: dict[str, Any]) -> UUID:
    row = conn.execute(
        """insert into public.catalogue_entries (org_id, name, enstru_code, unit, attributes,
             standards,
             item_id) values (%s, %s, %s, %s, %s, %s, %s) returning id""",
        (
            org_id,
            e["name"],
            e.get("enstru_code"),
            e.get("unit"),
            Jsonb(e.get("attributes") or {}),
            e.get("standards") or [],
            e.get("item_id"),
        ),
    ).fetchone()
    assert row is not None
    return UUID(str(row["id"]))


LIKE_ESCAPES = str.maketrans({"\\": "\\\\", "%": "\\%", "_": "\\_"})
FOLDED = sql.SQL("translate(lower(name), 'ёәғқңөұүһі', 'еагкноуухи')")
NAME_MATCH = sql.SQL(
    """org_id = %(org)s and (%(q)s = ''
       or extensions.similarity({f}, %(q)s) >= %(t)s
       or {f} like '%%' || %(like)s || '%%' escape '\\')"""
).format(f=FOLDED)


def search(
    conn: UserConn, org_id: UUID, q: str, attrs: dict[str, str] | None = None, limit: int = 20
) -> dict[str, Any]:
    """Name matches ranked by similarity; attribute filters run in SQL (jsonb containment) so a
    match past the first page is never lost. Empty results say which part emptied them."""
    needle = fold(q)
    params = {
        "org": org_id,
        "q": needle,
        "like": needle.translate(LIKE_ESCAPES),
        "t": SIMILARITY,
        "attrs": Jsonb(attrs or {}),
        "limit": max(1, min(limit, 100)),
    }
    rows = conn.execute(
        sql.SQL(
            """select id, name, enstru_code, unit, attributes, standards,
                 extensions.similarity({f}, %(q)s) as sim
               from public.catalogue_entries
               where {match} and attributes @> %(attrs)s
               order by sim desc, name limit %(limit)s"""
        ).format(f=FOLDED, match=NAME_MATCH),
        params,
    ).fetchall()
    found = [dict(r) for r in rows]
    why, names = None, len(found)
    if not found:
        row = conn.execute(
            sql.SQL("select count(*)::int as n from public.catalogue_entries where {m}").format(
                m=NAME_MATCH
            ),
            params,
        ).fetchone()
        names = row["n"] if row else 0
        why = "no_name_match" if not names else "filters_removed_all"
    return {"results": found, "empty_reason": why, "name_matches": names}


def price_history(conn: UserConn, org_id: UUID, entry_id: UUID) -> list[dict[str, Any]]:
    """Prices for the entry's Item from purchase lines, each with its source file and row.
    Offer prices join once offers carry Item links (D39)."""
    rows = conn.execute(
        """with e as (select item_id, name from public.catalogue_entries
                      where org_id = %(org)s and id = %(id)s)
           select 'purchase' as source, pl.purchased_on as on_date, pl.unit_price_kzt as price_kzt,
                  f.name as source_name, pl.source_row as source_row, pl.id as ref
           from public.purchase_lines pl join e on pl.item_id = e.item_id
           join public.files f on f.id = pl.file_id
           where pl.org_id = %(org)s and pl.unit_price_kzt is not null
           order by on_date desc nulls last limit 200""",
        {"org": org_id, "id": entry_id},
    ).fetchall()
    return [dict(r) for r in rows]


def analogs(conn: UserConn, org_id: UUID, entry_id: UUID, limit: int = 10) -> list[dict[str, Any]]:
    base = conn.execute(
        """select id, name, attributes, enstru_code from public.catalogue_entries
           where org_id = %s and id = %s""",
        (org_id, entry_id),
    ).fetchone()
    if base is None:
        raise LookupError("entry not found")
    others = conn.execute(
        """select id, name, attributes, enstru_code from public.catalogue_entries
           where org_id = %s and id <> %s and (enstru_code = %s or attributes ?| %s)""",
        (org_id, entry_id, base["enstru_code"], list(base["attributes"].keys()) or ["-"]),
    ).fetchall()
    out = []
    for o in others:
        same = sorted(k for k, v in base["attributes"].items() if o["attributes"].get(k) == v)
        differs = sorted(
            k
            for k in set(base["attributes"]) | set(o["attributes"])
            if base["attributes"].get(k) != o["attributes"].get(k)
        )
        stated = len(base["attributes"]) or 1
        out.append(
            {
                "id": o["id"],
                "name": o["name"],
                "same": same,
                "differs": differs,
                "match": str(Decimal(len(same)) / Decimal(stated)),
                "attributes": o["attributes"],
            }
        )
    out.sort(key=lambda a: (-Decimal(a["match"]), a["name"]))
    return out[:limit]


def feedback(
    conn: UserConn, org_id: UUID, entry_id: UUID, analog_id: UUID, accepted: bool, note: str | None
) -> None:
    conn.execute(
        """insert into public.analog_feedback (org_id, entry_id, analog_id, accepted, note)
           values (%s, %s, %s, %s, %s)""",
        (org_id, entry_id, analog_id, accepted, note),
    )


def acceptance(conn: UserConn, org_id: UUID) -> dict[str, Any]:
    """Analog acceptance rate from reviewer feedback (the latest decision per pair)."""
    row = conn.execute(
        """select count(*)::int as decided, count(*) filter (where accepted)::int as accepted
           from (select distinct on (entry_id, analog_id) accepted from public.analog_feedback
                 where org_id = %s order by entry_id, analog_id, created_at desc) x""",
        (org_id,),
    ).fetchone()
    assert row is not None
    rate = None if not row["decided"] else str(Decimal(row["accepted"]) / Decimal(row["decided"]))
    return {"decided": row["decided"], "accepted": row["accepted"], "rate": rate}
