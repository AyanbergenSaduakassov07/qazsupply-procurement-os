"""M4 gate (screening): zero known false negatives on the labelled set; FP load reported."""

from evals.screening.score import score


def test_no_known_sanctioned_party_is_missed() -> None:
    result = score()
    assert result["recall"] == 1.0, result["missed"]


def test_the_set_is_big_enough_and_has_negatives() -> None:
    result = score()
    assert result["positives"] >= 50 and result["negatives"] >= 20
