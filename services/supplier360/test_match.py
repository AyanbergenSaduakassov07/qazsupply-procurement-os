from hypothesis import given
from hypothesis import strategies as st

from services.supplier360.match import THRESHOLD, compare, skeleton_tokens


def test_kazakh_and_russian_patronymics_fold_to_the_same_root() -> None:
    assert skeleton_tokens("Сапарова Айгүл Нұрланқызы") == skeleton_tokens(
        "SAPAROVA, Aigul Nurlanovna"
    )
    assert skeleton_tokens("Әбенов Ерлан Маратұлы") == skeleton_tokens("Abenov Yerlan Maratovich")


def test_legal_forms_and_quotes_are_ignored() -> None:
    assert skeleton_tokens("ТОО «Альфа»") == skeleton_tokens("Alfa LLP") == ["alfa"]


def test_kazakh_latin_q_and_cyrillic_qaf_agree() -> None:
    assert compare("Qasymov Arman", "Қасымов Арман").score == 100


def test_the_explanation_names_every_aligned_pair() -> None:
    m = compare("Saparova Aigyl", "SAPAROVA, Aigul Nurlanovna")
    assert m.score >= THRESHOLD
    assert [(a, b) for a, b, _ in m.pairs[:2]] == [("saparova", "saparova"), ("aigil", "aigul")]


def test_a_lone_surname_never_reaches_the_threshold() -> None:
    assert compare("Ким", "KIM, Viktor").score < THRESHOLD


def test_one_shared_token_out_of_three_is_not_a_match() -> None:
    assert compare("Сапаров Ермек", "SAPAROVA, Aigul Nurlanovna").score < THRESHOLD


@given(st.text(max_size=60), st.text(max_size=60))
def test_score_is_bounded_and_never_crashes(a: str, b: str) -> None:
    assert 0 <= compare(a, b).score <= 100


@given(st.text(alphabet="абвгдеёжзийклмнопрстуфхцчшщъыьэюяәғқңөұүһі ", max_size=40))
def test_a_name_always_matches_itself(name: str) -> None:
    if skeleton_tokens(name):
        assert compare(name, name).score == 100
