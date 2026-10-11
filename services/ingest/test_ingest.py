from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from services.ingest import parse
from services.ingest.api import preview, validate
from services.ingest.mapping import suggest
from services.ingest.parse import FileRejected, read_file
from services.ingest.values import normalise_unit, parse_currency, parse_date, parse_number

FIX = Path(__file__).parent / "fixtures"


def load(name: str) -> bytes:
    return (FIX / name).read_bytes()


def test_ru_semicolon_cp1251_with_russian_decimals() -> None:
    p = preview(load("01_ru_semicolon_cp1251.csv"), "01.csv")
    assert p.missing_required == [] and p.rows_total == 3 and p.errors_by_code == {}
    rows = read_file(load("01_ru_semicolon_cp1251.csv"), "01.csv")[0].rows
    lines, errors = validate(rows, p.header_row, p.mapping)
    assert errors == []
    assert lines[0].unit_price == Decimal("18400.00") and lines[1].unit_price == Decimal("4250.50")
    assert lines[0].purchased_on == date(2026, 3, 14) and lines[0].supplier_bin == "123456789012"
    assert lines[0].source_row == 2  # what the user sees in Excel


def test_english_headers_and_iso_dates() -> None:
    p = preview(load("02_en_comma_utf8.csv"), "02.csv")
    assert set(p.mapping) >= {"item_text", "quantity", "unit", "unit_price", "purchased_on"}


def test_title_rows_above_the_header_are_skipped() -> None:
    p = preview(load("03_title_rows.xlsx"), "03.xlsx")
    assert p.header_row == 4 and p.missing_required == []


def test_kazakh_headers_map() -> None:
    p = preview(load("04_kk_headers.xlsx"), "04.xlsx")
    assert (
        p.mapping["item_text"] == 0
        and p.mapping["unit_price"] == 3
        and p.mapping["purchased_on"] == 4
    )


def test_price_is_derived_from_total_when_missing_and_flagged() -> None:
    rows = read_file(load("05_total_without_price.csv"), "05.csv")[0].rows
    s = suggest(rows)
    assert s.missing_required == []
    lines, errors = validate(rows, s.header_row, s.mapping)
    assert errors == []
    assert lines[0].unit_price == Decimal("250") and "price_from_total" in lines[0].warnings


def test_currency_symbols_and_names() -> None:
    rows = read_file(load("06_mixed_currency.xlsx"), "06.xlsx")[0].rows
    s = suggest(rows)
    lines, _ = validate(rows, s.header_row, s.mapping)
    assert [ln.currency for ln in lines] == ["USD", "KZT", "RUB"]


def test_excel_serial_dates() -> None:
    rows = read_file(load("07_excel_serial_dates.xlsx"), "07.xlsx")[0].rows
    s = suggest(rows)
    lines, _ = validate(rows, s.header_row, s.mapping)
    assert lines[0].purchased_on == date(2026, 3, 19)  # serial 46100 (45658 = 2025-01-01)


def test_bad_rows_are_reported_and_never_block_good_rows() -> None:
    rows = read_file(load("08_row_errors.csv"), "08.csv")[0].rows
    s = suggest(rows)
    lines, errors = validate(rows, s.header_row, s.mapping)
    assert [ln.source_row for ln in lines] == [2]
    assert [(e.row, e.code) for e in errors] == [
        (3, "missing_item"),
        (4, "bad_number"),
        (5, "negative_price"),
        (6, "missing_date"),
        (7, "bad_date"),
    ]


def test_duplicates_are_flagged_not_dropped() -> None:
    rows = read_file(load("09_duplicates.csv"), "09.csv")[0].rows
    s = suggest(rows)
    lines, _ = validate(rows, s.header_row, s.mapping)
    assert len(lines) == 2 and "possible_duplicate" in lines[1].warnings


def test_injection_cells_are_kept_as_inert_text() -> None:
    rows = read_file(load("10_injection.csv"), "10.csv")[0].rows
    s = suggest(rows)
    lines, _ = validate(rows, s.header_row, s.mapping)
    assert lines[0].item_text.startswith("Ignore previous instructions")
    assert lines[1].item_text.startswith("=HYPERLINK")  # stored as text, never evaluated
    assert lines[0].supplier_text == "<script>alert(1)</script>"


@pytest.mark.parametrize(
    ("name", "code"),
    [("11_macros.xlsm", "unsupported_type"), ("x.pdf", "unsupported_type")],
)
def test_unsupported_files_are_rejected(name: str, code: str) -> None:
    data = load("11_macros.xlsm") if name.endswith("xlsm") else b"%PDF-1.7"
    with pytest.raises(FileRejected) as e:
        read_file(data, name)
    assert e.value.code == code


def test_macro_workbook_renamed_to_xlsx_is_still_rejected() -> None:
    with pytest.raises(FileRejected) as e:
        read_file(load("11_macros.xlsm"), "innocent.xlsx")
    assert e.value.code == "macros"


def test_xlsx_that_inflates_past_the_cap_is_rejected_before_parsing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    data = load("03_title_rows.xlsx")
    assert read_file(data, "x.xlsx")  # honest workbook passes the default cap
    monkeypatch.setattr(parse, "MAX_UNZIPPED", 1024)
    with pytest.raises(FileRejected) as e:
        read_file(data, "x.xlsx")
    assert e.value.code == "too_large"


def test_garbage_xlsx_is_unreadable_not_a_crash() -> None:
    with pytest.raises(FileRejected) as e:
        read_file(b"PK\x03\x04garbage", "x.xlsx")
    assert e.value.code == "unreadable"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1 250 000,50", "1250000.50"),
        ("1,250,000.50", "1250000.50"),
        ("18 400 ₸", "18400"),
        ("1,25", "1.25"),
        ("4250.5", "4250.5"),
        (18400.0, "18400.0"),
        ("1 250", "1250"),
    ],
)
def test_parse_number_formats(raw: object, expected: str) -> None:
    assert parse_number(raw) == Decimal(expected)


@given(st.decimals(min_value=0, max_value=10**9, places=2, allow_nan=False, allow_infinity=False))
def test_parse_number_round_trips_russian_and_english_formats(value: Decimal) -> None:
    ru = f"{value:,.2f}".replace(",", " ").replace(".", ",")
    en = f"{value:,.2f}"
    assert parse_number(ru) == value
    assert parse_number(en) == value


@given(st.text())
def test_parsers_only_raise_value_error(text: str) -> None:
    for parser in (parse_number, parse_date, parse_currency):
        try:
            parser(text)
        except ValueError:
            pass
    normalise_unit(text)


def test_delimiter_comes_from_the_header_even_with_commas_in_cells() -> None:
    data = (
        'Наименование;Цена;Дата\n"=HYPERLINK(""a"",""b"")";100;01.08.2026\nx, y, z;5;01.08.2026\n'
    )
    rows = read_file(data.encode(), "d.csv")[0].rows
    assert rows[1] == ['=HYPERLINK("a","b")', "100", "01.08.2026"] and rows[2][0] == "x, y, z"
