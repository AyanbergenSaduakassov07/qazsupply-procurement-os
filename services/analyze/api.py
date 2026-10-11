"""Analyze module public interface.

run(): staff-only. Loads eligible lines, runs the deterministic detectors, cross-checks the money
with the independent SQL implementation, then writes a draft Report with Findings and Evidence in
one transaction (as the signed-in reviewer, under RLS). Clients see it only after release (M3).
"""

import json
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from services.analyze import detectors, savings_sql
from services.analyze.config import AnalysisConfig
from services.analyze.detectors import VERSION, Line, run_all
from services.gateway.db import UserConn


class NotStaff(Exception):
    pass


class SavingsMismatch(Exception):
    """Python and SQL disagree: nothing is persisted (fail closed)."""


@dataclass(frozen=True)
class AnalysisResult:
    report_id: UUID | None
    computation_id: str
    findings: int
    total_saving_kzt: Decimal
    lines_used: int
    lines_excluded: int


def _lines(conn: UserConn, org_id: UUID) -> tuple[list[Line], int]:
    rows = conn.execute(
        """select id, item_id, supplier_id, quantity, unit_norm, unit_price_kzt, purchased_on,
             (match_status in ('auto', 'confirmed') and item_id is not null
              and unit_price_kzt is not null and quantity is not null) as eligible
           from public.purchase_lines where org_id = %s""",
        (org_id,),
    ).fetchall()
    eligible = [
        Line(
            r["id"],
            r["item_id"],
            r["supplier_id"],
            Decimal(r["quantity"]),
            r["unit_norm"],
            Decimal(r["unit_price_kzt"]),
            r["purchased_on"],
        )
        for r in rows
        if r["eligible"]
    ]
    return eligible, len(rows) - len(eligible)


def cross_check(conn: UserConn, org_id: UUID, cfg: AnalysisConfig, lines: list[Line]) -> None:
    """Raw detector money (before cross-detector de-duplication) must equal the SQL result."""
    py_pv = {(d.item_id, d.supplier_id): d.saving_kzt for d in detectors.price_variance(lines, cfg)}
    py_out = {d.line_ids[0]: d.saving_kzt for d in detectors.outliers(lines, cfg)}
    sql_pv = savings_sql.price_variance(conn, org_id, cfg)
    sql_out = savings_sql.outliers(conn, org_id, cfg)
    if py_pv != sql_pv or py_out != sql_out:
        raise SavingsMismatch(
            f"price_variance py={len(py_pv)} sql={len(sql_pv)}; "
            f"outlier py={len(py_out)} sql={len(sql_out)}"
        )


def run(conn: UserConn, org_id: UUID) -> AnalysisResult:
    staff = conn.execute("select private.is_staff(%s) as ok", (org_id,)).fetchone()
    if not staff or not staff["ok"]:
        raise NotStaff
    org = conn.execute(
        "select analysis_config from public.organizations where id = %s", (org_id,)
    ).fetchone()
    cfg = AnalysisConfig.for_org(org["analysis_config"] if org else None)
    lines, excluded = _lines(conn, org_id)
    drafts = run_all(lines, cfg)
    cross_check(conn, org_id, cfg, lines)
    computation_id = f"analyze-{VERSION}-{uuid.uuid4().hex[:12]}"
    if not drafts:
        return AnalysisResult(None, computation_id, 0, Decimal(0), len(lines), excluded)
    start = min(ln.purchased_on for ln in lines)
    end = max(ln.purchased_on for ln in lines)
    report = conn.execute(
        """insert into public.reports (org_id, title, period_start, period_end)
           values (%s, %s, %s, %s) returning id""",
        (org_id, f"Spend X-ray {start:%d.%m.%Y}-{end:%d.%m.%Y}", start, end),
    ).fetchone()
    assert report is not None
    config_snapshot = {k: str(v) for k, v in cfg.__dict__.items()}
    for d in drafts:
        ev = conn.execute(
            """insert into public.evidence
                 (org_id, computation_id, method, code_version, inputs, result)
               values (%s, %s, %s, %s, %s, %s) returning id""",
            (
                org_id,
                computation_id,
                d.method,
                f"analyze {VERSION}",
                json.dumps(
                    {
                        "detector": d.type,
                        "details": d.details,
                        "config": config_snapshot,
                        "lines": len(d.line_ids),
                    },
                    ensure_ascii=False,
                ),
                d.saving_kzt,
            ),
        ).fetchone()
        assert ev is not None
        with conn.cursor() as cur:
            cur.executemany(
                """insert into public.evidence_sources (evidence_id, purchase_line_id, org_id)
                   values (%s, %s, %s)""",
                [(ev["id"], line_id, org_id) for line_id in d.line_ids],
            )
        finding = conn.execute(
            """insert into public.findings (org_id, report_id, type, detector, detector_version,
                 saving_estimate, currency, method, confidence, item_id, supplier_id, details)
               values (%s, %s, %s, %s, %s, %s, 'KZT', %s, %s, %s, %s, %s) returning id""",
            (
                org_id,
                report["id"],
                d.type,
                d.detector,
                VERSION,
                d.saving_kzt,
                d.method,
                d.confidence,
                d.item_id,
                d.supplier_id,
                json.dumps(d.details, ensure_ascii=False),
            ),
        ).fetchone()
        assert finding is not None
        conn.execute(
            """insert into public.finding_evidence (finding_id, evidence_id, org_id)
               values (%s, %s, %s)""",
            (finding["id"], ev["id"], org_id),
        )
    total = sum((d.saving_kzt for d in drafts), Decimal(0))
    return AnalysisResult(report["id"], computation_id, len(drafts), total, len(lines), excluded)


def findings(conn: UserConn, org_id: UUID, report_id: UUID) -> list[dict[str, Any]]:
    """Findings of one report with the latest review decision (RLS hides unreleased reports and
    rejected findings from client roles; notes on kept findings are client-visible)."""
    return conn.execute(
        """select f.id, f.type, f.saving_estimate, f.currency, f.method, f.confidence, f.details,
             i.name as item_name, i.enstru_code, s.name as supplier_name,
             (select fe.evidence_id from public.finding_evidence fe where fe.finding_id = f.id
              limit 1) as evidence_id,
             d.decision::text as decision, d.note as decision_note,
             d.reviewer_id as decided_by, d.created_at as decided_at
           from public.findings f
           left join public.items i on i.id = f.item_id
           left join public.suppliers s on s.id = f.supplier_id
           left join lateral (
             select v.decision, v.note, v.reviewer_id, v.created_at from public.reviews v
             where v.finding_id = f.id order by v.created_at desc, v.id desc limit 1
           ) d on true
           where f.org_id = %s and f.report_id = %s
           order by f.saving_estimate desc, f.type""",
        (org_id, report_id),
    ).fetchall()
