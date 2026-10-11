from hypothesis import given
from hypothesis import strategies as st

from services.normalize.suppliers import bin_checksum_ok, normalise_name, resolution_key


def test_legal_forms_and_quotes_are_ignored() -> None:
    assert normalise_name("ТОО «Альфа-Трейд»") == "альфа-трейд"
    assert normalise_name("Alfa-Trade LLP") == "alfa-trade"
    assert normalise_name("«Альфа-Трейд» ЖШС") == "альфа-трейд"


def test_bin_wins_over_name() -> None:
    assert resolution_key("ТОО Альфа", "123456789012") == ("bin", "123456789012")
    assert resolution_key("ТОО Альфа", None) == ("name", "альфа")
    assert resolution_key(None, None) is None


def _with_check_digit(first11: str) -> str | None:
    for check in range(10):
        if bin_checksum_ok(first11 + str(check)):
            return first11 + str(check)
    return None


@given(st.text(alphabet="0123456789", min_size=11, max_size=11))
def test_bin_checksum_has_exactly_one_valid_check_digit_or_none(first11: str) -> None:
    valid = [d for d in range(10) if bin_checksum_ok(first11 + str(d))]
    assert len(valid) <= 1
    if (full := _with_check_digit(first11)) is not None:
        corrupted = full[:-1] + str((int(full[-1]) + 1) % 10)
        assert not bin_checksum_ok(corrupted)
