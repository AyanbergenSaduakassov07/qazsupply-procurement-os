"""Score the screening matcher on evals/screening/cases.py.

recall          share of positive queries whose expected entity is among the hits (gate: 1.0)
fp_per_query    hits on the wrong entity per query (review load)
neg_hit_rate    share of negative queries with any hit
Usage: uv run python -m evals.screening.score [--threshold 82]
Results append to evals/screening/results.jsonl.
"""

import json
import subprocess  # noqa: S404 - fixed argv
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from evals.screening.cases import ENTITIES, QUERIES
from services.supplier360.match import THRESHOLD, best

RESULTS = Path(__file__).parent / "results.jsonl"


def score(threshold: float = THRESHOLD) -> dict[str, Any]:
    positives = [q for q in QUERIES if q.expect]
    negatives = [q for q in QUERIES if not q.expect]
    missed, wrong_hits, neg_hit = [], 0, 0
    for q in QUERIES:
        hits = {
            e.id
            for e in ENTITIES
            if e.kind == q.kind and best(q.name, list(e.names))[1].score >= threshold
        }
        if q.expect and q.expect not in hits:
            missed.append(f"{q.name} -> {q.expect} ({q.variant})")
        wrong_hits += len(hits - {q.expect})
        neg_hit += (not q.expect) and bool(hits)
    return {
        "threshold": threshold,
        "positives": len(positives),
        "negatives": len(negatives),
        "recall": round(1 - len(missed) / len(positives), 4),
        "missed": missed,
        "fp_per_query": round(wrong_hits / len(QUERIES), 4),
        "neg_hit_rate": round(neg_hit / len(negatives), 4),
    }


def main() -> int:
    threshold = (
        float(sys.argv[sys.argv.index("--threshold") + 1])
        if "--threshold" in sys.argv
        else THRESHOLD
    )
    sha = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True
    ).stdout.strip()  # noqa: S603, S607
    row = {"at": datetime.now(UTC).isoformat(timespec="seconds"), "git": sha, **score(threshold)}
    if "--no-log" not in sys.argv:
        with RESULTS.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(json.dumps(row, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
