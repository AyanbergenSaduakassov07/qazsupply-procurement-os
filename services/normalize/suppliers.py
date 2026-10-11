"""Supplier entity resolution: BIN first, then a normalised legal name.

Merges are reversible (suppliers.merged_into); nothing here deletes or rewrites a supplier.
"""

import re

LEGAL_FORMS = re.compile(
    r"\b(тоо|too|ооо|ао|аоо|пао|зао|ип|жшс|жк|ак|llp|llc|ltd|jsc|inc|gmbh|ltd\.)\b\.?",
    re.IGNORECASE,
)
QUOTES = re.compile(r"[«»\"'“”„`]")
BIN_RE = re.compile(r"^\d{12}$")


def normalise_name(name: str) -> str:
    """'ТОО «Альфа-Трейд»' -> 'альфа-трейд'; 'Alfa LLP' -> 'alfa'."""
    text = QUOTES.sub(" ", name.lower().replace("ё", "е"))
    text = LEGAL_FORMS.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip(" .,-")


def bin_checksum_ok(bin_: str) -> bool:
    """Kazakhstan BIN/IIN control digit (12th digit).

    UNVERIFIED against an official specification (algorithm as widely published):
    weights 1..11 mod 11; if the result is 10, weights 3..11,1,2 mod 11; 10 again = invalid.
    Used only to rank evidence, never to reject a line.
    """
    if not BIN_RE.match(bin_):
        return False
    digits = [int(c) for c in bin_]
    for weights in (range(1, 12), [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]):
        check = sum(d * w for d, w in zip(digits[:11], weights, strict=True)) % 11
        if check != 10:
            return check == digits[11]
    return False


def resolution_key(name: str | None, bin_: str | None) -> tuple[str, str] | None:
    if bin_ and BIN_RE.match(bin_):
        return ("bin", bin_)
    if name and (norm := normalise_name(name)):
        return ("name", norm)
    return None
