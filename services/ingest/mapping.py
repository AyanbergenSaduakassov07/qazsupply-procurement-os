"""Header detection and column-mapping suggestions (deterministic; the user confirms).

Targets are the fields of a Purchase Line. Headers are matched against ru / kk / en
synonyms seen in 1C/SAP exports; unmapped columns are then sniffed by their values.
"""

import re
from dataclasses import dataclass

from services.ingest.values import parse_date, parse_number

FIELDS = (
    "item_text",
    "quantity",
    "unit",
    "unit_price",
    "total",
    "currency",
    "purchased_on",
    "supplier_text",
    "supplier_bin",
)
REQUIRED = ("item_text", "unit_price", "purchased_on")


def missing_required(mapping: dict[str, int]) -> list[str]:
    """unit_price may be derived from total / quantity, so either form satisfies it."""
    has_price = "unit_price" in mapping or {"total", "quantity"} <= mapping.keys()
    return [f for f in REQUIRED if f not in mapping and not (f == "unit_price" and has_price)]


SYNONYMS: dict[str, tuple[str, ...]] = {
    "item_text": (
        "наименование",
        "номенклатура",
        "товар",
        "описание",
        "предмет",
        "атауы",
        "тауар",
        "item",
        "description",
        "material",
        "product",
    ),
    "quantity": ("количество", "кол-во", "кол.", "колич", "саны", "qty", "quantity"),
    "unit": ("ед. изм", "ед.изм", "единица", "ед изм", "өлшем", "unit", "uom"),
    "unit_price": ("цена", "цена за ед", "бағасы", "баға", "price", "unit price"),
    "total": ("сумма", "стоимость", "итого", "сомасы", "amount", "total"),
    "currency": ("валюта", "валютасы", "currency", "curr"),
    "purchased_on": ("дата", "дата поставки", "дата закупки", "күні", "date", "period"),
    "supplier_text": ("поставщик", "контрагент", "жеткізуші", "supplier", "vendor"),
    "supplier_bin": ("бин", "иин", "бсн", "жсн", "bin", "iin", "tax id"),
}
BIN = re.compile(r"^\d{12}$")


@dataclass(frozen=True)
class MappingSuggestion:
    header_row: int  # 1-based row number of the header in the sheet
    columns: list[str]  # header labels as written
    mapping: dict[str, int]  # field -> 0-based column index
    missing_required: list[str]


def _norm(label: object) -> str:
    return re.sub(r"\s+", " ", str(label).strip().lower().replace("ё", "е"))


def _field_for(label: str) -> str | None:
    best: tuple[int, str] | None = None
    for field, synonyms in SYNONYMS.items():
        for syn in synonyms:
            if label == syn or label.startswith(syn) or (len(syn) > 3 and syn in label):
                rank = 0 if label == syn else 1 if label.startswith(syn) else 2
                if best is None or rank < best[0]:
                    best = (rank, field)
    return best[1] if best else None


def find_header(rows: list[list[object]], scan: int = 15) -> int:
    """0-based index of the row that looks most like a header (most synonym hits)."""
    scored = [
        (sum(_field_for(_norm(v)) is not None for v in row if str(v).strip()), -i, i)
        for i, row in enumerate(rows[:scan])
    ]
    hits, _, idx = max(scored, default=(0, 0, 0))
    return idx if hits >= 2 else 0


def suggest(rows: list[list[object]]) -> MappingSuggestion:
    h = find_header(rows)
    header = [str(v).strip() for v in rows[h]] if rows else []
    mapping: dict[str, int] = {}
    for col, label in enumerate(header):
        field = _field_for(_norm(label))
        if field and field not in mapping:
            mapping[field] = col
    _sniff(rows[h + 1 : h + 51], mapping, len(header))
    return MappingSuggestion(h + 1, header, mapping, missing_required(mapping))


def _sniff(sample: list[list[object]], mapping: dict[str, int], width: int) -> None:
    """Fill unmapped date / BIN columns from their values (>= 80% of non-empty cells parse)."""
    used = set(mapping.values())

    def share(col: int, ok: object) -> float:
        cells = [r[col] for r in sample if col < len(r) and str(r[col]).strip()]
        if not cells:
            return 0.0
        good = 0
        for c in cells:
            try:
                good += bool(ok(c))  # type: ignore[operator]
            except ValueError:
                pass
        return good / len(cells)

    for col in range(width):
        if col in used:
            continue
        if "supplier_bin" not in mapping and share(col, lambda c: BIN.match(str(c).strip())) >= 0.8:
            mapping["supplier_bin"] = col
        elif "purchased_on" not in mapping and share(col, parse_date) >= 0.8:
            mapping["purchased_on"] = col
        elif "unit_price" not in mapping and share(col, parse_number) >= 0.8:
            mapping["unit_price"] = col
