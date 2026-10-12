"""Screening runs: every Party in a supplier's chain against sanctions/PEP (by name), the
supplier against the unreliable-supplier registry (by BIN), and the goods bought from it against
the dual-use list. Each check is one append-only `screenings` row with its hits; nothing blocks."""

from dataclasses import dataclass, field
from functools import cache
from typing import Any
from uuid import UUID

from psycopg import sql
from psycopg.types.json import Jsonb

from connectors.dualuse.sample import SampleDualUse
from connectors.goszakup.sample import SampleGoszakup
from connectors.opensanctions.sample import SampleSanctions
from services.gateway.db import UserConn
from services.supplier360.match import THRESHOLD, best, skeleton_tokens

KINDS = {"person": {"Person"}, "company": {"Company", "Organization", "LegalEntity"}}


@dataclass
class Sources:
    sanctions: SampleSanctions = field(default_factory=SampleSanctions)
    goszakup: SampleGoszakup = field(default_factory=SampleGoszakup)
    dualuse: SampleDualUse = field(default_factory=SampleDualUse)


@dataclass
class ScreenSummary:
    screenings: int = 0
    possible_matches: int = 0


@cache
def _entities(sanctions: SampleSanctions) -> list[dict[str, Any]]:
    return [dict(r.payload) for r in sanctions.fetch()]


def _record(
    conn: UserConn,
    org_id: UUID,
    subject: tuple[str, UUID],
    list_source: str,
    version: str,
    trigger: str,
    hits: list[dict[str, Any]],
    out: ScreenSummary,
    sample: bool,
) -> None:
    column = "party_id" if subject[0] == "party" else "item_id"
    row = conn.execute(
        sql.SQL(
            """insert into public.screenings (org_id, {col}, list_source, list_version, trigger,
                 result, sample) values (%s, %s, %s, %s, %s, %s, %s) returning id"""
        ).format(col=sql.Identifier(column)),
        (
            org_id,
            subject[1],
            list_source,
            version,
            trigger,
            "possible_match" if hits else "clear",
            sample,
        ),
    ).fetchone()
    assert row is not None
    for h in hits:
        conn.execute(
            """insert into public.screening_hits (org_id, screening_id, entry_id, entry_name,
                 entry_topics, score, explanation) values (%s, %s, %s, %s, %s, %s, %s)""",
            (
                org_id,
                row["id"],
                h["entry_id"],
                h["entry_name"],
                h["topics"],
                h["score"],
                Jsonb(h["explanation"]),
            ),
        )
    out.screenings += 1
    out.possible_matches += bool(hits)


def name_hits(party: dict[str, Any], entities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    hits = []
    for e in entities:
        if e["schema"] not in KINDS[party["kind"]]:
            continue
        alias, m = best(party["name"], list(e["names"]))
        if m.score < THRESHOLD:
            continue
        hits.append(
            {
                "entry_id": e["id"],
                "entry_name": alias,
                "topics": list(e["topics"]),
                "score": m.score,
                "explanation": {
                    "method": m.method,
                    "threshold": THRESHOLD,
                    "pairs": m.pairs,
                    "party_birth_year": party.get("birth_year"),
                    "entry_birth_year": e["birth_year"],
                    "entry_countries": e["countries"],
                    "program": e["program"],
                },
            }
        )
    return hits


def item_hits(text: str, controls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    low = text.lower()
    return [
        {
            "entry_id": c["id"],
            "entry_name": c["label_en"],
            "topics": ["dual_use"],
            "score": 100,
            "explanation": {
                "method": "keyword",
                "keywords": [k for k in c["keywords"] if k in low],
                "label_ru": c["label_ru"],
                "label_kk": c["label_kk"],
            },
        }
        for c in controls
        if any(k in low for k in c["keywords"])
    ]


def screen(
    conn: UserConn,
    org_id: UUID,
    supplier_ids: list[UUID],
    parties: list[dict[str, Any]],
    root: dict[str, Any],
    trigger: str,
    src: Sources,
) -> ScreenSummary:
    out = ScreenSummary()
    entities = _entities(src.sanctions)
    for p in parties:
        if skeleton_tokens(p["name"]):
            hits = name_hits(p, entities)
            _record(
                conn,
                org_id,
                ("party", p["id"]),
                "opensanctions",
                src.sanctions.version,
                trigger,
                hits,
                out,
                src.sanctions.is_sample,
            )
    listed = src.goszakup.unreliable(root["bin"]) if root.get("bin") else None
    rnu = (
        []
        if listed is None
        else [
            {
                "entry_id": f"rnu:{listed.payload['bin']}",
                "entry_name": listed.payload["name"],
                "topics": ["unreliable_supplier"],
                "score": 100,
                "explanation": {
                    "method": "bin_exact",
                    **{
                        k: listed.payload[k]
                        for k in ("included_on", "until", "reason_ru", "reason_kk", "reason_en")
                    },
                },
            }
        ]
    )
    _record(
        conn,
        org_id,
        ("party", root["id"]),
        "goszakup_rnu",
        src.goszakup.version,
        trigger,
        rnu,
        out,
        src.goszakup.is_sample,
    )
    controls = [dict(r.payload) for r in src.dualuse.fetch()]
    items = conn.execute(
        """select distinct i.id, i.name from public.purchase_lines pl
           join public.items i on i.id = pl.item_id and i.org_id = pl.org_id
           where pl.org_id = %s and pl.supplier_id = any(%s)""",
        (org_id, supplier_ids),
    ).fetchall()
    for it in items:
        _record(
            conn,
            org_id,
            ("item", it["id"]),
            "dualuse",
            src.dualuse.version,
            trigger,
            item_hits(it["name"], controls),
            out,
            src.dualuse.is_sample,
        )
    return out
