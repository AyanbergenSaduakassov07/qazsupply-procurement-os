"""Score the matcher on the TEST split. Appends a result row to evals/matcher/results.jsonl.

Definitions (lines with a true code = "matchable"):
- auto_precision: correct auto matches / all auto matches (an auto match on a NONE line is wrong)
- abstain_rate: matchable lines sent to review / matchable lines
- top1 / top5: true code is the first / within the first five candidates (matchable lines)
- none_handled: NONE lines that were NOT auto-matched / NONE lines
- bundled_recall: BUNDLED lines flagged as bundled / BUNDLED lines
Usage: uv run python -m evals.matcher.score [--gate]
"""

import json
import subprocess  # noqa: S404 - fixed argv
import sys
import time
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from evals.matcher.common import HOLDOUT, golden, read_rows, sample_entries
from services.normalize.matcher import Calibration, Matcher

RESULTS = Path(__file__).parent / "results.jsonl"
GATE = {"auto_precision": 0.90, "abstain_rate_max": 0.15}
# Safety floors on the realistic holdout: wrong auto-codes and auto-coded junk must not regress.
SAFETY = {"auto_precision": 0.95, "none_handled": 0.95}


def score(rows: list[dict[str, str]], matcher: Matcher) -> dict[str, Any]:
    auto = auto_ok = matchable = abstain = top1 = top5 = none = none_ok = bundled = bundled_ok = 0
    by_lang: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    start = time.perf_counter()
    for r in rows:
        res = matcher.match(r["text"])
        codes = [c.code for c in res.candidates]
        if r["label"] == "BUNDLED":
            bundled += 1
            bundled_ok += res.status == "bundled"
            continue
        if res.status == "auto":
            auto += 1
            auto_ok += res.code == r["label"]
        if r["label"] == "NONE":
            none += 1
            none_ok += res.status != "auto"
            continue
        matchable += 1
        abstain += res.status != "auto"
        top1 += bool(codes) and codes[0] == r["label"]
        top5 += r["label"] in codes
        by_lang[r["lang"]][0] += 1
        by_lang[r["lang"]][1] += bool(codes) and codes[0] == r["label"]
    seconds = time.perf_counter() - start
    return {
        "auto_precision": round(auto_ok / auto, 4) if auto else 0.0,
        "abstain_rate": round(abstain / matchable, 4),
        "top1": round(top1 / matchable, 4),
        "top5": round(top5 / matchable, 4),
        "none_handled": round(none_ok / none, 4) if none else None,
        "bundled_recall": round(bundled_ok / bundled, 4) if bundled else None,
        "top1_by_lang": {k: round(v[1] / v[0], 4) for k, v in sorted(by_lang.items())},
        "lines": len(rows),
        "ms_per_line": round(seconds * 1000 / len(rows), 2),
        "llm_cost_usd_per_1k_lines": 0.0,  # lexical only; re-rank disabled in this run
    }


def main() -> int:
    matcher = Matcher(sample_entries(), Calibration.load())
    result = score(golden("test"), matcher)
    result["holdout_realistic"] = score(read_rows(HOLDOUT), matcher)
    git = ["git", "rev-parse", "--short", "HEAD"]
    sha = subprocess.run(git, capture_output=True, text=True).stdout.strip()  # noqa: S603
    row = {
        "at": datetime.now(UTC).isoformat(timespec="seconds"),
        "git": sha,
        "set": "golden_synthetic/test",
        "calibration": Calibration.load().version,
        **result,
    }
    if "--no-log" not in sys.argv:
        with RESULTS.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(json.dumps(row, ensure_ascii=False, indent=2))
    if "--gate" in sys.argv:
        hold = result["holdout_realistic"]
        checks = {
            "synthetic auto_precision >= 0.90": result["auto_precision"] >= GATE["auto_precision"],
            "synthetic abstain_rate <= 0.15": result["abstain_rate"] <= GATE["abstain_rate_max"],
            "holdout auto_precision >= 0.95": hold["auto_precision"] >= SAFETY["auto_precision"],
            "holdout none_handled >= 0.95": hold["none_handled"] >= SAFETY["none_handled"],
        }
        for name, ok in checks.items():
            print(("PASS " if ok else "FAIL ") + name)
        print(
            "NOTE: the M2 gate (>= 90% top-1 at <= 15% abstain on the owner's"
            " hand-labelled set) is NOT evaluated here."
        )
        return 0 if all(checks.values()) else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
