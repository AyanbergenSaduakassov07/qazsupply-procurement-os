from collections.abc import Sequence

from hypothesis import given, settings
from hypothesis import strategies as st

from services.normalize.matcher import Calibration, Candidate, Entry, Matcher
from services.normalize.text import tokens

ENTRIES = [
    Entry("SYN-A", ("Подшипник шариковый 6205", "6205 шарикті мойынтірек")),
    Entry("SYN-B", ("Подшипник шариковый 6310", "6310 шарикті мойынтірек")),
    Entry("SYN-C", ("Перчатки нитриловые", "Нитрилді қолғаптар")),
    Entry("SYN-D", ("Болт М12", "М12 болт")),
    Entry("SYN-E", ("Гайка М12", "М12 сомын")),
]
CAL = Calibration(w_score=0.1, w_margin=0.05, bias=-6.0, threshold=0.6, min_auto_score=70)


def test_kazakh_without_kazakh_letters_matches() -> None:
    assert Matcher(ENTRIES, CAL).match("НИТРИЛДИ КОЛГАПТАР").code == "SYN-C"


def test_latin_transliteration_matches() -> None:
    assert Matcher(ENTRIES, CAL).match("perchatki nitrilovye").code == "SYN-C"


def test_model_numbers_decide_between_near_identical_items() -> None:
    m = Matcher(ENTRIES, CAL)
    assert m.match("Подшипник SKF 6310-2RS").code == "SYN-B"
    assert m.match("Подшипник 6205 ZZ").code == "SYN-A"


def test_wrong_model_number_never_auto_matches() -> None:
    result = Matcher(ENTRIES, CAL).match("Подшипник 6206")
    assert result.status != "auto"


def test_bundled_line_is_flagged_not_forced() -> None:
    result = Matcher(ENTRIES, CAL).match("Болт М12 + гайка М12 (комплект)")
    assert result.status == "bundled" and result.code is None


def test_low_evidence_always_goes_to_review() -> None:
    result = Matcher(ENTRIES, CAL).match("Краска фасадная")
    assert result.status == "review"


def test_reranker_cannot_introduce_a_code_outside_the_candidates() -> None:
    def rogue(text: str, cands: Sequence[Candidate]) -> str:
        return "SYN-INJECTED"

    result = Matcher(ENTRIES, CAL, reranker=rogue).match("подшипник")
    assert result.code in {c.code for c in result.candidates}


@settings(max_examples=300, deadline=None)
@given(st.text())
def test_tokenizer_and_matcher_never_crash_on_any_text(text: str) -> None:
    tokens(text)
    result = Matcher(ENTRIES, CAL).match(text)
    assert result.status in {"auto", "review", "bundled"}
    assert 0.0 <= result.confidence <= 1.0
    assert result.code is None or result.code in {e.code for e in ENTRIES}
