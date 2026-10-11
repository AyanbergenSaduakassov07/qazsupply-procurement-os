"""Server-side check of a model answer before anyone sees it.

The model may only phrase what the data says. A sentence survives only if:
- every Evidence id it cites was given to the model for this question;
- every number in it equals a figure of something it cites (a finding's saving, its confidence,
  or a report figure when it cites the report itself). Digits that are part of a cited item or
  supplier name (a bearing "6205", a bolt "M12") are names, not figures;
- it contains no link (answers never send the reader anywhere).
Anything else is dropped and counted, never shown.
"""

import re
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

REPORT_REF = "report"
# A number: digits with optional grouping (space, NBSP, narrow NBSP, comma, dot) and decimals.
NUMBER = re.compile(r"\d(?:[\d    .,]*\d)?")
LINK = re.compile(r"(?i)\b(?:https?://|www\.)|\b[\w-]+\.(?:com|kz|ru|net|org|io)\b")


@dataclass(frozen=True)
class Figure:
    """What a citation may back: the figures of one finding (or of the report)."""

    ref: str
    amounts: tuple[Decimal, ...] = ()
    percents: tuple[int, ...] = ()
    counts: tuple[int, ...] = ()
    names: tuple[str, ...] = ()


@dataclass(frozen=True)
class Sentence:
    text: str
    evidence_ids: tuple[str, ...]


@dataclass
class Checked:
    answerable: bool
    sentences: list[Sentence] = field(default_factory=list)
    dropped: int = 0
    numbers_total: int = 0
    numbers_cited: int = 0


def _digit_forms(amount: Decimal) -> set[str]:
    """Every digit string an amount may be written as: whole tenge (rounded or cut) or with tiyn."""
    whole = amount.quantize(Decimal(1), rounding=ROUND_HALF_UP)
    tiyn = (amount * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return {str(int(whole)), str(int(amount)), str(int(tiyn))}


def _allowed(figures: list[Figure]) -> tuple[set[str], set[str]]:
    """(plain numbers, percentages) the cited figures can back. A percentage backs only `N%`."""
    plain: set[str] = set()
    for f in figures:
        for a in f.amounts:
            plain |= _digit_forms(a)
        plain |= {str(c) for c in f.counts}
    return plain, {str(p) for f in figures for p in f.percents}


def _numbers(text: str, names: list[str]) -> list[tuple[str, bool]]:
    """(digits, is_percent) for every number outside the cited names."""
    for name in sorted(names, key=len, reverse=True):
        if name:
            text = text.replace(name, " ")
    return [
        (re.sub(r"\D", "", m.group()), text[m.end() :].lstrip(" \u00a0\u202f").startswith("%"))
        for m in NUMBER.finditer(text)
    ]


def check(raw: object, figures: dict[str, Figure]) -> Checked:
    """Validate the model's JSON answer against the figures it was given."""
    if not isinstance(raw, dict) or not isinstance(raw.get("answerable"), bool):
        return Checked(answerable=False, dropped=1)
    if not raw["answerable"]:
        return Checked(answerable=False)
    out = Checked(answerable=True)
    items = raw.get("sentences")
    for item in items if isinstance(items, list) else []:
        text = item.get("text") if isinstance(item, dict) else None
        ids = item.get("evidence_ids") if isinstance(item, dict) else None
        if not isinstance(text, str) or not text.strip() or not isinstance(ids, list):
            out.dropped += 1
            continue
        cited = [figures[i] for i in ids if isinstance(i, str) and i in figures]
        numbers = _numbers(text, [n for f in cited for n in f.names])
        out.numbers_total += len(numbers)
        unknown_ref = len(cited) != len(ids)
        plain, percents = _allowed(cited)
        unbacked = any(n not in (percents if pct else plain) for n, pct in numbers)
        if unknown_ref or LINK.search(text) or unbacked:
            out.dropped += 1
            continue
        out.numbers_cited += len(numbers)
        out.sentences.append(Sentence(text.strip(), tuple(f.ref for f in cited)))
    if not out.sentences:
        out.answerable = False
    return out
