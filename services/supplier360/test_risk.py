from hypothesis import given
from hypothesis import strategies as st

from services.supplier360.risk import WEIGHTS, assess, weights_for

NONE: dict[str, dict[str, object] | None] = dict.fromkeys(WEIGHTS)


def test_clean_known_supplier_is_ok() -> None:
    r = assess(NONE, WEIGHTS, known=True)
    assert (r.score, r.verdict, r.top) == (0, "ok", [])


def test_unknown_is_never_ok() -> None:
    assert assess(NONE, WEIGHTS, known=False).verdict == "unknown"


def test_confirmed_sanctions_is_high_risk_even_with_weight_zero() -> None:
    weights = weights_for({"sanctions_confirmed": 0})
    r = assess({**NONE, "sanctions_confirmed": {"hit": "x"}}, weights, known=True)
    assert r.verdict == "high_risk" and r.score == 0


def test_top_reasons_are_the_three_heaviest_triggered_factors() -> None:
    signals = {**NONE, "young_company": {}, "unreliable_supplier": {}, "pep_related": {},
               "foreign_owner": {}}  # fmt: skip
    r = assess(signals, WEIGHTS, known=True)
    assert [f.code for f in r.top] == ["unreliable_supplier", "pep_related", "young_company"]
    assert r.score == 85 and r.verdict == "high_risk"


def test_org_overrides_are_clamped_and_unknown_keys_ignored() -> None:
    w = weights_for({"young_company": 500, "pep_related": -3, "nope": 9})
    assert (w["young_company"], w["pep_related"], "nope" in w) == (100, 0, False)


@given(st.sets(st.sampled_from(sorted(WEIGHTS))))
def test_score_is_the_capped_sum_of_triggered_weights(fired: set[str]) -> None:
    r = assess({k: ({} if k in fired else None) for k in WEIGHTS}, WEIGHTS, known=True)
    assert r.score == min(100, sum(WEIGHTS[k] for k in fired))
    assert r.verdict != "ok" or r.score < 20
