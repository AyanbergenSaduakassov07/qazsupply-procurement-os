"""Normalize module public interface.

run():    for pending lines: unit, FX to KZT (dated NBK rate), item match, supplier resolution.
queue():  lines a human must decide (review / bundled), with candidates and reasons.
review(): accept / choose / reject / undo a match; every action is written to match_feedback.
All writes run as the signed-in user (RLS applies).
"""

import json
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from functools import cache
from typing import Any
from uuid import UUID

from connectors.enstru.sample import SampleEnstru
from connectors.fx.nbk import NbkFx
from services.gateway.db import UserConn
from services.ingest.api import normalise_unit
from services.normalize.matcher import Calibration, Entry, Matcher
from services.normalize.suppliers import normalise_name, resolution_key

BATCH = 1000
REVIEW_ACTIONS = {"accept", "choose", "reject", "undo"}


@dataclass(frozen=True)
class ClassifierEntry:
    code: str
    name_ru: str
    name_kk: str
    unit: str


@dataclass(frozen=True)
class RunSummary:
    processed: int
    auto: int
    review: int
    bundled: int
    fx_missing: int
    suppliers_created: int
    sample_classifier: bool


@cache
def classifier() -> dict[str, ClassifierEntry]:
    """Classifier entries by code. M2: synthetic sample (connectors/enstru); real data later."""
    return {
        r.payload["code"]: ClassifierEntry(
            r.payload["code"], r.payload["name_ru"], r.payload["name_kk"], r.payload["unit"]
        )
        for r in SampleEnstru().fetch()
    }


@cache
def matcher() -> Matcher:
    return Matcher(
        [Entry(e.code, (e.name_ru, e.name_kk)) for e in classifier().values()], Calibration.load()
    )


def _item_id(conn: UserConn, org_id: UUID, code: str, cache_: dict[str, UUID]) -> UUID:
    if code in cache_:
        return cache_[code]
    row = conn.execute(
        "select id from public.items where org_id = %s and enstru_code = %s limit 1", (org_id, code)
    ).fetchone()
    if row is None:
        entry = classifier()[code]
        row = conn.execute(
            """insert into public.items (org_id, enstru_code, name, unit)
               values (%s, %s, %s, %s) returning id""",
            (org_id, code, entry.name_ru, entry.unit),
        ).fetchone()
    assert row is not None
    cache_[code] = row["id"]
    return cache_[code]


def _supplier_id(
    conn: UserConn,
    org_id: UUID,
    name: str | None,
    bin_: str | None,
    cache_: dict[tuple[str, str], UUID],
) -> tuple[UUID | None, bool]:
    key = resolution_key(name, bin_)
    if key is None:
        return None, False
    if key in cache_:
        return cache_[key], False
    kind, value = key
    if kind == "bin":
        row = conn.execute(
            """select id from public.suppliers
               where org_id = %s and bin = %s and merged_into is null limit 1""",
            (org_id, value),
        ).fetchone()
    else:
        rows = conn.execute(
            "select id, name from public.suppliers where org_id = %s and merged_into is null",
            (org_id,),
        ).fetchall()
        row = next((r for r in rows if normalise_name(r["name"]) == value), None)
    created = False
    if row is None:
        row = conn.execute(
            "insert into public.suppliers (org_id, name, bin) values (%s, %s, %s) returning id",
            (org_id, (name or value).strip()[:255], bin_ if kind == "bin" else None),
        ).fetchone()
        created = True
    assert row is not None
    cache_[key] = row["id"]
    return cache_[key], created


def run(
    conn: UserConn, org_id: UUID, file_id: UUID | None = None, fx: NbkFx | None = None
) -> RunSummary:
    fx = fx or NbkFx()
    lines = conn.execute(
        """select id, item_text, unit, unit_price, currency, purchased_on, supplier_text,
             supplier_bin
           from public.purchase_lines
           where org_id = %s and match_status = 'pending' and (%s::uuid is null or file_id = %s)
           order by file_id, source_row""",
        (org_id, file_id, file_id),
    ).fetchall()
    items: dict[str, UUID] = {}
    suppliers: dict[tuple[str, str], UUID] = {}
    counts = {"auto": 0, "review": 0, "bundled": 0}
    fx_missing = created = 0
    updates: list[tuple[Any, ...]] = []
    m = matcher()
    for ln in lines:
        result = m.match(ln["item_text"])
        counts[result.status] += 1
        item_id = (
            _item_id(conn, org_id, result.code, items)
            if result.status == "auto" and result.code
            else None
        )
        supplier_id, was_created = _supplier_id(
            conn, org_id, ln["supplier_text"], ln["supplier_bin"], suppliers
        )
        created += was_created
        price_kzt = rate = rate_day = None
        if ln["unit_price"] is not None and ln["currency"] and ln["purchased_on"]:
            try:
                rate, rate_day = fx.rate(ln["currency"], ln["purchased_on"])
                price_kzt = (Decimal(ln["unit_price"]) * rate).quantize(Decimal("0.0001"))
            except LookupError:
                fx_missing += 1
        cands = [
            {
                "code": c.code,
                "score": c.score,
                "matched": list(c.matched),
                "name": classifier()[c.code].name_ru,
            }
            for c in result.candidates
        ]
        updates.append(
            (
                item_id,
                supplier_id,
                result.status,
                result.method,
                result.confidence,
                json.dumps(cands, ensure_ascii=False),
                _unit(ln["unit"]),
                price_kzt,
                rate,
                rate_day,
                ln["id"],
            )
        )
    with conn.cursor() as cur:
        for i in range(0, len(updates), BATCH):
            cur.executemany(
                """update public.purchase_lines set item_id = %s, supplier_id = %s,
                     match_status = %s, match_method = %s, match_confidence = %s,
                     match_candidates = %s, unit_norm = %s,
                     unit_price_kzt = %s, fx_rate = %s, fx_date = %s
                   where id = %s""",
                updates[i : i + BATCH],
            )
    return RunSummary(
        len(lines),
        counts["auto"],
        counts["review"],
        counts["bundled"],
        fx_missing,
        created,
        sample_classifier=True,
    )


def _unit(raw: str | None) -> str | None:
    return normalise_unit(raw) if raw else None


def queue(conn: UserConn, org_id: UUID, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    return conn.execute(
        """select id, item_text, unit, unit_price, currency, purchased_on, supplier_text,
             match_status, match_confidence, match_candidates, source_row,
             (select name from public.files f where f.id = pl.file_id) as file_name
           from public.purchase_lines pl
           where org_id = %s and match_status in ('review', 'bundled')
           order by purchased_on desc nulls last, id limit %s offset %s""",
        (org_id, limit, offset),
    ).fetchall()


def review(
    conn: UserConn, org_id: UUID, line_id: UUID, action: str, code: str | None = None
) -> dict[str, Any]:
    if action not in REVIEW_ACTIONS:
        raise ValueError("unknown action")
    line = conn.execute(
        """select id, match_status, match_candidates, item_id,
             (select enstru_code from public.items i where i.id = pl.item_id) as current_code
           from public.purchase_lines pl where org_id = %s and id = %s""",
        (org_id, line_id),
    ).fetchone()
    if line is None:
        raise LookupError("line not found")
    candidates: Sequence[dict[str, Any]] = line["match_candidates"] or []
    if action == "accept":
        code = candidates[0]["code"] if candidates else None
        if code is None:
            raise ValueError("nothing to accept")
    if action == "choose" and (code is None or code not in classifier()):
        raise ValueError("unknown code")
    items: dict[str, UUID] = {}
    if action in {"accept", "choose"} and code:
        item_id: UUID | None = _item_id(conn, org_id, code, items)
        status, method = "confirmed", "human"
    elif action == "reject":
        item_id, status, method, code = None, "rejected", "human", None
    else:  # undo: back to the queue
        item_id, status, method, code = None, "review", "human-undo", None
    conn.execute(
        """update public.purchase_lines set item_id = %s, match_status = %s, match_method = %s
           where org_id = %s and id = %s""",
        (item_id, status, method, org_id, line_id),
    )
    conn.execute(
        """insert into public.match_feedback
             (org_id, purchase_line_id, action, previous_code, chosen_code)
           values (%s, %s, %s, %s, %s)""",
        (org_id, line_id, action, line["current_code"], code),
    )
    return {"id": line_id, "match_status": status, "code": code}


def counts(conn: UserConn, org_id: UUID) -> dict[str, int]:
    rows = conn.execute(
        """select match_status, count(*) as n from public.purchase_lines
           where org_id = %s group by 1""",
        (org_id,),
    ).fetchall()
    return {r["match_status"]: r["n"] for r in rows}


__all__ = ["RunSummary", "run", "queue", "review", "counts", "classifier"]
