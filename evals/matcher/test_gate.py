"""Matcher regression gate, run by the CI `unit` job (pytest). Thresholds live in score.py."""

from evals.matcher.common import HOLDOUT, golden, read_rows, sample_entries
from evals.matcher.score import GATE, SAFETY, score
from services.normalize.matcher import Calibration, Matcher


def test_matcher_does_not_regress() -> None:
    matcher = Matcher(sample_entries(), Calibration.load())
    synthetic = score(golden("test"), matcher)
    holdout = score(read_rows(HOLDOUT), matcher)
    assert synthetic["auto_precision"] >= GATE["auto_precision"], synthetic
    assert synthetic["abstain_rate"] <= GATE["abstain_rate_max"], synthetic
    assert holdout["auto_precision"] >= SAFETY["auto_precision"], holdout
    assert holdout["none_handled"] >= SAFETY["none_handled"], holdout
