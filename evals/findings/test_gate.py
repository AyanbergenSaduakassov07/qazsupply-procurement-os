"""Detector precision gate on the synthetic planted datasets (CI `unit` job)."""

from evals.findings.score import GATE_PRECISION, score
from evals.findings.synthetic import DATASETS


def test_detectors_meet_synthetic_precision_and_recall() -> None:
    for make in DATASETS:
        result = score(make())
        assert result["precision"] >= GATE_PRECISION, result
        assert result["recall"] >= 0.90, result
