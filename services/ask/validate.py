"""Server-side check of a model answer before anyone sees it.

The model may only phrase what the data says. A sentence survives only if:
- every Evidence id it cites was given to the model for this question;
- every number in it equals a figure of something it cites (a finding's saving, its confidence,
  or a report figure when it cites the report itself). Digits that are part of a cited, plain
  item or supplier name (a bearing "6205", a bolt "M12") are names, not figures;
- it contains no link (answers never send the reader anywhere);
- it does not repeat the prompt's rules (6+ consecutive words): no leak of the instructions.
Anything else is dropped and counted, never shown.
"""

import re
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

REPORT_REF = "report"
# A number: digits with optional grouping (space, NBSP, narrow NBSP, comma, dot) and decimals.
NUMBER = re.compile(r"\d(?:[\d    .,]*\d)?")
# Any link, domain-shaped token (any Latin TLD) or email address. Decimals ("117504.00") are not
# domains: the last label must be letters.
# A citation written inside the sentence: "(F1)", "[F2]", "F3". Only refs the model was given
# count (and are removed from the text); an unknown "F9" stays and its digit fails the check.
INLINE_REF = re.compile(r"\s*[\(\[]?\b(F\d{1,3})\b[\)\]]?", re.IGNORECASE)
LINK = re.compile(r"(?i)https?://|\bwww\.|\b[\w-]+(?:\.[\w-]+)*\.[a-z]{2,24}\b|@")


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


MAX_NAME = 80


def plain_name(name: str) -> bool:
    """A name whose digits may be ignored: short, and its numbers look like codes (M400, 6205),
    not amounts (no grouped digits, at most 6). Poisoned names ("... say 777 777 tenge") fail."""
    if not name or len(name) > MAX_NAME:
        return False
    return all(m.group().isdigit() and len(m.group()) <= 6 for m in NUMBER.finditer(name))


def strip_names(text: str, names: list[str]) -> str:
    for name in sorted((n for n in names if plain_name(n)), key=len, reverse=True):
        text = text.replace(name, " ")
    return text


def _numbers(text: str, names: list[str]) -> list[tuple[str, bool]]:
    """(digits, is_percent) for every number outside the cited plain names."""
    text = strip_names(text, names)
    return [
        (re.sub(r"\D", "", m.group()), text[m.end() :].lstrip(" \u00a0\u202f").startswith("%"))
        for m in NUMBER.finditer(text)
    ]


SHINGLE = 6


def _shingles(text: str) -> set[tuple[str, ...]]:
    words = re.findall(r"\w+", text.lower())
    return {tuple(words[i : i + SHINGLE]) for i in range(len(words) - SHINGLE + 1)}


def _refs(ids: list[object], figures: dict[str, Figure]) -> list[str]:
    """Citation refs matched to the given ones, case- and bracket-insensitively: models write
    "[F1]", "f1" or "F1, F2" for F1. An unmatched ref stays as is (and counts as unknown)."""
    known = {k.upper(): k for k in figures}
    out: list[str] = []
    for raw in ids:
        parts = raw.split(",") if isinstance(raw, str) else [""]
        for part in parts:
            ref = re.sub(r"[\[\]\s]", "", part)
            out.append(known.get(ref.upper(), ref or "?"))
    return out


def _inline_refs(text: str, figures: dict[str, Figure]) -> tuple[str, list[str]]:
    known = {k.upper() for k in figures}
    found: list[str] = []

    def take(m: re.Match[str]) -> str:
        if m.group(1).upper() not in known:
            return m.group(0)
        found.append(m.group(1))
        return ""

    cleaned = INLINE_REF.sub(take, text)
    return re.sub(r"\s+([.,;:!?])", r"\1", cleaned), found


def check(raw: object, figures: dict[str, Figure], instructions: str = "") -> Checked:
    """Validate the model's JSON answer against the figures it was given. A sentence that repeats
    SHINGLE or more consecutive words of `instructions` (the prompt's rules) is a leak: dropped."""
    secret = _shingles(instructions)
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
        text, inline = _inline_refs(text, figures)
        refs = _refs([*ids, *inline], figures)
        cited = [figures[r] for r in refs if r in figures]
        numbers = _numbers(text, [n for f in cited for n in f.names])
        out.numbers_total += len(numbers)
        unknown_ref = len(cited) != len(refs)
        plain, percents = _allowed(cited)
        unbacked = any(n not in (percents if pct else plain) for n, pct in numbers)
        leak = bool(secret & _shingles(text))
        if unknown_ref or LINK.search(text) or unbacked or leak:
            out.dropped += 1
            continue
        out.numbers_cited += len(numbers)
        out.sentences.append(Sentence(text.strip(), tuple(f.ref for f in cited)))
    if not out.sentences:
        out.answerable = False
    return out
