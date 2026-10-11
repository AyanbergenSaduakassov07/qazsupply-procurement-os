"""Precision / recall of the detectors on the synthetic planted datasets.

A finding is a true positive if a plant of the same type has the same item (and supplier when the
plant names one; for outliers, the same line). Usage: uv run python -m evals.findings.score
"""

import json
import sys
from collections import defaultdict
from decimal import Decimal
from typing import Any

from evals.findings.synthetic import DATASETS, Dataset
from services.analyze.config import AnalysisConfig
from services.analyze.detectors import FindingDraft, run_all

GATE_PRECISION = 0.80


def _share_holds(f: FindingDraft, ds: Dataset) -> bool:
    """Concentration is a pure ratio: verify it from the data (planted orders of other types can
    legitimately concentrate an item). Reported separately as 'definitional' true positives."""
    lines = [ln for ln in ds.lines if ln.item_id == f.item_id and ln.supplier_id]
    total = sum((ln.price_kzt * ln.quantity for ln in lines), Decimal(0))
    top = sum(
        (ln.price_kzt * ln.quantity for ln in lines if ln.supplier_id == f.supplier_id), Decimal(0)
    )
    return total > 0 and top / total >= AnalysisConfig().concentration_share


def _matches(f: FindingDraft, ds: Dataset) -> bool:
    if f.type == "concentration" and _share_holds(f, ds):
        return True
    for p in ds.plants:
        if p.type != f.type or p.item != f.item_id:
            continue
        if p.line is not None:
            if p.line in f.line_ids:
                return True
        elif p.supplier is None or p.supplier == f.supplier_id:
            return True
    return False


def score(ds: Dataset) -> dict[str, Any]:
    findings = run_all(ds.lines, AnalysisConfig())
    per: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])  # tp, reported, planted
    for f in findings:
        per[f.type][1] += 1
        per[f.type][0] += _matches(f, ds)
    for p in ds.plants:
        per[p.type][2] += 1
    found_plants = sum(
        any(_matches(f, ds) and f.type == p.type and f.item_id == p.item for f in findings)
        for p in ds.plants
    )
    tp = sum(v[0] for v in per.values())
    return {
        "dataset": ds.name,
        "lines": len(ds.lines),
        "precision": round(tp / len(findings), 4) if findings else 1.0,
        "recall": round(found_plants / len(ds.plants), 4),
        "by_type": {
            k: {
                "precision": round(v[0] / v[1], 4) if v[1] else None,
                "reported": v[1],
                "planted": v[2],
            }
            for k, v in sorted(per.items())
        },
    }


def main() -> int:
    results = [score(make()) for make in DATASETS]
    print(json.dumps(results, indent=2))
    ok = all(r["precision"] >= GATE_PRECISION for r in results)
    print("GATE (synthetic) precision >= 0.80:", "PASS" if ok else "FAIL")
    print("NOTE: the M2 gate needs the owner's two hand-audited datasets; not evaluated here.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
