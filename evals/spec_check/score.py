"""Score the ТЗ checker on evals/spec_check/cases.py.

extraction_f1   micro F1 over requirements (comparator, value, unit) and standards
issue_precision / issue_recall   over (case, issue kind) pairs
Usage: uv run python -m evals.spec_check.score [--no-log]   (appends to results.jsonl)
"""

import json
import subprocess  # noqa: S404 - fixed argv
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from evals.spec_check.cases import CASES, HOLDOUT, Case
from services.procurement.spec_check import check

RESULTS = Path(__file__).parent / "results.jsonl"


def _f1(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    p = tp / (tp + fp) if tp + fp else 1.0
    r = tp / (tp + fn) if tp + fn else 1.0
    return p, r, (2 * p * r / (p + r) if p + r else 0.0)


def score(cases: list[Case] = CASES) -> dict[str, Any]:
    tp = fp = fn = itp = ifp = ifn = 0
    misses: list[str] = []
    for i, c in enumerate(cases):
        r = check(c.text)
        got = {(q.comparator, q.value, q.unit) for q in r.requirements} | {
            ("std", s, "") for s in r.standards
        }
        want = c.requirements | {("std", s, "") for s in c.standards}
        tp, fp, fn = tp + len(got & want), fp + len(got - want), fn + len(want - got)
        kinds = {x.kind for x in r.issues}
        itp, ifp, ifn = (
            itp + len(kinds & c.issues),
            ifp + len(kinds - c.issues),
            ifn + len(c.issues - kinds),
        )
        if got != want or kinds != c.issues:
            misses.append(
                f"{i}: extra={sorted(got - want)} missing={sorted(want - got)} "
                f"issues+={sorted(kinds - c.issues)} issues-={sorted(c.issues - kinds)}"
            )
    p, rc, f1 = _f1(tp, fp, fn)
    ip, ir, _ = _f1(itp, ifp, ifn)
    return {
        "cases": len(cases),
        "extraction_precision": round(p, 4),
        "extraction_recall": round(rc, 4),
        "extraction_f1": round(f1, 4),
        "issue_precision": round(ip, 4),
        "issue_recall": round(ir, 4),
        "misses": misses,
    }


def main() -> int:
    sha = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True
    ).stdout.strip()  # noqa: S603, S607
    row = {
        "at": datetime.now(UTC).isoformat(timespec="seconds"),
        "git": sha,
        "set": "golden",
        **score(),
        "holdout": score(HOLDOUT),
    }
    if "--no-log" not in sys.argv:
        with RESULTS.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(json.dumps(row, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
