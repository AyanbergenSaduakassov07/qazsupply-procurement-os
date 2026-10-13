from hypothesis import given
from hypothesis import strategies as st

from services.procurement.spec_check import check


def test_brand_without_equivalent_is_flagged_and_fixed_in_the_suggestion() -> None:
    r = check("Подшипник SKF 6205, ширина 15 мм.")
    assert [i.kind for i in r.issues if i.kind == "brand_lock"] == ["brand_lock"]
    assert "SKF или эквивалент" in r.suggested


def test_or_equivalent_anywhere_clears_brand_locking() -> None:
    assert not [
        i
        for i in check("Масло Mobil 15W-40 или эквивалент, 20 л.").issues
        if i.kind == "brand_lock"
    ]


def test_viscosity_grade_is_not_read_as_watts() -> None:
    assert [(q.value, q.unit) for q in check("Масло 15W-40, 20 л.").requirements] == [("20", "л")]


def test_the_same_parameter_with_two_values_is_flagged() -> None:
    kinds = [i.kind for i in check("Длина 100 м, длина 120 м.").issues]
    assert "duplicate_parameter" in kinds


@given(st.text(max_size=300))
def test_never_crashes_and_suggestion_keeps_unflagged_text(text: str) -> None:
    r = check(text)
    if not any(i.span for i in r.issues):
        assert r.suggested == text
