"""Cell value parsing: numbers, dates, currencies, units. Pure functions, no I/O.

Every parser returns a value or raises ValueError; the caller turns that into a row error code.
"""

import re
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

_SPACES = re.compile(r"[\s  ']")
_CURRENCY_NOISE = re.compile(r"(₸|тг\.?|тенге|kzt|usd|\$|руб\.?|rub|€|eur)", re.IGNORECASE)

CURRENCIES = {
    "kzt": "KZT",
    "₸": "KZT",
    "тг": "KZT",
    "тг.": "KZT",
    "тенге": "KZT",
    "теңге": "KZT",
    "usd": "USD",
    "$": "USD",
    "доллар": "USD",
    "rub": "RUB",
    "руб": "RUB",
    "руб.": "RUB",
    "рубль": "RUB",
    "eur": "EUR",
    "€": "EUR",
    "евро": "EUR",
    "cny": "CNY",
    "юань": "CNY",
}
UNITS = {
    "шт": "pcs",
    "шт.": "pcs",
    "штука": "pcs",
    "pcs": "pcs",
    "pc": "pcs",
    "дана": "pcs",
    "ед": "pcs",
    "кг": "kg",
    "kg": "kg",
    "т": "t",
    "тн": "t",
    "тонна": "t",
    "t": "t",
    "л": "l",
    "l": "l",
    "литр": "l",
    "м": "m",
    "m": "m",
    "метр": "m",
    "п.м": "m",
    "пог.м": "m",
    "уп": "pack",
    "уп.": "pack",
    "упак": "pack",
    "упаковка": "pack",
    "pack": "pack",
    "қорап": "pack",
    "пара": "pair",
    "пар": "pair",
    "pair": "pair",
    "жұп": "pair",
    "компл": "set",
    "комплект": "set",
    "set": "set",
    "жиынтық": "set",
    "услуга": "service",
    "усл": "service",
    "service": "service",
    "қызмет": "service",
}
EXCEL_EPOCH = date(1899, 12, 30)


def parse_number(raw: object) -> Decimal:
    """'1 250 000,50' / '1,250,000.50' / '18 400 ₸' / '18400,5' / 18400.0 -> Decimal."""
    if isinstance(raw, int | float | Decimal) and not isinstance(raw, bool):
        return Decimal(str(raw))
    text = _CURRENCY_NOISE.sub("", _SPACES.sub("", str(raw))).strip()
    if not text:
        raise ValueError("empty")
    if "," in text and "." in text:
        # The right-most separator is the decimal one.
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif text.count(",") > 1:
        text = text.replace(",", "")  # 1,250,000 (thousands)
    elif "," in text:
        # Russian-locale exports: a single comma is the decimal separator (1,250 == 1.25).
        text = text.replace(",", ".")
    try:
        value = Decimal(text)
    except InvalidOperation as e:
        raise ValueError("not a number") from e
    if not value.is_finite():
        raise ValueError("not a number")
    return value


def parse_date(raw: object) -> date:
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    if isinstance(raw, int | float) and not isinstance(raw, bool) and 20000 < raw < 80000:
        return EXCEL_EPOCH + timedelta(days=int(raw))  # Excel serial date
    text = str(raw).strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%d.%m.%y", "%d-%m-%Y", "%Y.%m.%d", "%d/%m/%y"):
        try:
            return datetime.strptime(text[:10] if fmt == "%Y-%m-%d" else text, fmt).date()
        except ValueError:
            continue
    raise ValueError("not a date")


def parse_currency(raw: object) -> str:
    text = str(raw).strip().lower()
    if text.upper() in {"KZT", "USD", "RUB", "EUR", "CNY"}:
        return text.upper()
    if text in CURRENCIES:
        return CURRENCIES[text]
    raise ValueError("unknown currency")


def normalise_unit(raw: object) -> str | None:
    text = str(raw).strip().lower().rstrip(".") if raw is not None else ""
    return UNITS.get(text) or UNITS.get(text + ".") if text else None
