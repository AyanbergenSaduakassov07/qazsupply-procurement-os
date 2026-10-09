"""Fit the matcher calibration on the TRAIN split and write services/normalize/calibration.json.

Logistic regression on (top score, margin) -> P(top-1 correct); then the lowest threshold whose
train auto-precision is >= TARGET_PRECISION. Usage: uv run python -m evals.matcher.train
"""

import json
import math
from datetime import date

from evals.matcher.common import golden, sample_entries
from services.normalize.matcher import CALIBRATION, Calibration, Matcher

TARGET_PRECISION = 0.95


def features() -> list[tuple[float, float, int]]:
    matcher = Matcher(sample_entries(), Calibration())
    rows = []
    for r in golden("train"):
        if r["label"] == "BUNDLED":
            continue
        cands = matcher.candidates(r["text"])
        if not cands:
            continue
        top = cands[0].score
        margin = top - (cands[1].score if len(cands) > 1 else 0.0)
        rows.append((top, margin, int(cands[0].code == r["label"])))
    return rows


def fit(
    rows: list[tuple[float, float, int]], epochs: int = 4000, lr: float = 0.05
) -> tuple[float, float, float]:
    w1 = w2 = b = 0.0
    for _ in range(epochs):
        g1 = g2 = gb = 0.0
        for top, margin, y in rows:
            x1, x2 = top / 100, margin / 100  # scaled for stable gradients
            p = 1 / (1 + math.exp(-(w1 * x1 + w2 * x2 + b)))
            g1 += (p - y) * x1
            g2 += (p - y) * x2
            gb += p - y
        n = len(rows)
        w1, w2, b = w1 - lr * g1 / n * 10, w2 - lr * g2 / n * 10, b - lr * gb / n * 10
    return w1 / 100, w2 / 100, b  # back to raw-score units


def main() -> None:
    rows = features()
    w_score, w_margin, bias = fit(rows)
    cal = Calibration(w_score, w_margin, bias)
    floor = Calibration().min_auto_score
    scored = sorted(((cal.confidence(t, m), y) for t, m, y in rows if t >= floor), reverse=True)
    threshold, best_cover = 0.99, 0
    for i in range(1, len(scored) + 1):
        auto = scored[:i]
        precision = sum(y for _, y in auto) / i
        if precision >= TARGET_PRECISION and i > best_cover:
            threshold, best_cover = auto[-1][0], i
    result = {
        "w_score": round(w_score, 6),
        "w_margin": round(w_margin, 6),
        "bias": round(bias, 6),
        "threshold": round(threshold, 4),
        "min_auto_score": floor,
        "version": f"{date.today().isoformat()}-synthetic",
    }
    CALIBRATION.write_text(json.dumps(result, indent=2) + "\n")
    print(
        json.dumps(
            {**result, "train_rows": len(rows), "train_auto_coverage": best_cover / len(rows)}
        )
    )


if __name__ == "__main__":
    main()
