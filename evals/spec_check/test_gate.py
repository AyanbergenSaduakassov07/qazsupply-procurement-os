"""M5 regression gate for the ТЗ checker (golden set). The holdout is reported, not gated."""

from evals.spec_check.score import score


def test_golden_extraction_and_issues_do_not_regress() -> None:
    r = score()
    assert r["extraction_f1"] >= 0.95, r["misses"]
    assert r["issue_precision"] >= 0.95 and r["issue_recall"] >= 0.95, r["misses"]
