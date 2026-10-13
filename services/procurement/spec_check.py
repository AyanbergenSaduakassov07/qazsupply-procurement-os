"""ТЗ (technical specification) checker, rules only (CONTEXT: Spec). No model reads the text, so
supplier- or buyer-written specs cannot steer anything.

Extracts parameters (name, comparator, value, unit) and standards (ГОСТ, СТ РК, ISO, EN, ТУ), and
flags: brand-locking without "or equivalent", vague wording, parameters missing for the item
family, conflicting or superseded standards, and one parameter given two different values.
Returns a suggested rewrite the reviewer sees as a diff; nothing is changed without them.
The word lists below are SAMPLE knowledge (to be grown from reviewer feedback), not legal rules.
"""

import re
from dataclasses import dataclass, field

UNITS = (
    r"мм|см|м|км|кг|г|т|л|мл|кВт|Вт|кВ|В|А|бар|МПа|кПа|°C|℃|%|шт|об/мин|мм²"
    r"|mm|cm|kg|kW|W|V|A|MPa|bar"
)
NUM = r"\d+(?:[.,]\d+)?"
COMPARATORS = {
    "не менее": ">=", "не ниже": ">=", "от": ">=", "минимум": ">=", "at least": ">=", "min": ">=",
    "кем дегенде": ">=", "не более": "<=", "не выше": "<=", "до": "<=", "максимум": "<=",
    "at most": "<=", "max": "<=", "аспайтын": "<=",
}  # fmt: skip
PARAM = re.compile(
    rf"(?:(?P<name>[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі][\w\s\-]{{1,40}}?)\s*[:—–-]?\s*)?"
    rf"(?P<cmp>{'|'.join(sorted(map(re.escape, COMPARATORS), key=len, reverse=True))})?\s*"
    rf"(?<![\d.,])(?P<value>{NUM}(?:\s*[-–]\s*{NUM})?)\s*(?P<unit>{UNITS})(?![\w²\-])",
    re.IGNORECASE,
)
STANDARD = re.compile(
    r"\b(?P<std>(?:ГОСТ\s?Р?|СТ\s?РК|ISO|EN|DIN|ASTM|ТУ)\s?[\d.\-:]+(?:-\d{2,4})?)", re.IGNORECASE
)
BRANDS = (
    "Caterpillar", "Komatsu", "SKF", "FAG", "NSK", "Bosch", "Siemens", "ABB", "Schneider", "Hilti",
    "Makita", "DeWalt", "3M", "Shell", "Mobil", "Castrol", "Atlas Copco", "Sandvik", "Volvo",
    "Cummins", "Grundfos", "Danfoss", "Legrand", "Philips", "Honeywell", "Ansell",
)  # fmt: skip
EQUIVALENT = re.compile(
    r"или\s+(?:эквивалент|аналог)|либо\s+эквивалент|or\s+equivalent|немесе\s+(?:баламасы|аналогы)",
    re.IGNORECASE,
)
VAGUE = (
    "высокого качества", "высококачественн", "качественн", "надежн", "надёжн", "современн",
    "оптимальн", "при необходимости", "и т.д", "и т. д", "и прочее", "достаточн", "соответствующ",
    "в хорошем состоянии", "high quality", "reliable", "modern", "etc", "as needed",
    "сапалы", "сенімді", "заманауи", "т.б.",
)  # fmt: skip
# Item family -> (keywords, parameters a spec should state). SAMPLE knowledge.
FAMILIES: dict[str, tuple[tuple[str, ...], tuple[tuple[str, tuple[str, ...]], ...]]] = {
    "cement": (("цемент", "cement"), (
        ("strength_class", ("марк", "класс прочност", "м400", "м500", "cem")),
        ("standard", ("гост", "ст рк", "en 197")),
        ("packaging", ("упаков", "мешк", "навал", "биг-бэг", "bag")),
    )),
    "gloves": (("перчатк", "gloves", "қолғап"), (
        ("size", ("размер", "size", "өлшем")),
        ("material", ("нитрил", "латекс", "хлопок", "кожа", "nitrile", "latex", "cotton")),
    )),
    "bearing": (("подшипник", "bearing"), (
        ("bore", ("внутренн", "bore", "d=")),
        ("outer_diameter", ("наружн", "outer", "d=")),
        ("width", ("ширин", "width", "b=")),
    )),
    "cable": (("кабел", "cable"), (
        ("cross_section", ("сечени", "мм²", "cross")),
        ("cores", ("жил", "core", "х1", "х2", "х3", "х4", "х6", "x1", "x2", "x3", "x4", "x6")),
        ("voltage", ("напряжени", "кв", "kv", " в ")),
    )),
    "oil": (("масло", "oil", "май"), (
        ("viscosity", ("вязкост", "sae", "w-", "viscosity")),
        ("api_class", ("api", "acea")),
        ("volume", ("л", "литр", "litre")),
    )),
}  # fmt: skip
# Standards that must not be cited together (superseded / conflicting). SAMPLE knowledge.
CONFLICTS = (
    ({"гост10178"}, {"гост31108"}, "ГОСТ 10178 is superseded by ГОСТ 31108 for cement"),
)  # fmt: skip


@dataclass(frozen=True)
class Requirement:
    name: str
    comparator: str
    value: str
    unit: str
    span: tuple[int, int]


@dataclass(frozen=True)
class Issue:
    kind: (
        str  # brand_lock | vague | missing_parameter | conflicting_standards | duplicate_parameter
    )
    message: str
    span: tuple[int, int] | None = None
    suggestion: str | None = None


@dataclass
class Result:
    requirements: list[Requirement] = field(default_factory=list)
    standards: list[str] = field(default_factory=list)
    family: str | None = None
    issues: list[Issue] = field(default_factory=list)
    suggested: str = ""


def _norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def _norm_std(std: str) -> str:
    return re.sub(r"[\s.]", "", std.lower())


def check(text: str) -> Result:
    out = Result()
    low = text.lower()
    for m in PARAM.finditer(text):
        name = _norm_name((m.group("name") or "").split(",")[-1])
        out.requirements.append(
            Requirement(name, COMPARATORS.get((m.group("cmp") or "").lower(), "="),
                        m.group("value").replace(",", "."), m.group("unit"), m.span())
        )  # fmt: skip
    out.standards = list(dict.fromkeys(_norm_std(m.group("std")) for m in STANDARD.finditer(text)))
    _brands(text, out)
    _vague(text, low, out)
    _missing(low, out)
    _conflicts(out)
    _duplicates(out)
    out.suggested = _suggest(text, out)
    return out


def _brands(text: str, out: Result) -> None:
    if EQUIVALENT.search(text):
        return
    for b in BRANDS:
        for m in re.finditer(rf"\b{re.escape(b)}\b", text, re.IGNORECASE):
            out.issues.append(Issue(
                "brand_lock",
                f"Brand '{b}' without 'or equivalent' locks out other suppliers.",
                m.span(),
                f"{m.group(0)} или эквивалент",
            ))  # fmt: skip


def _vague(text: str, low: str, out: Result) -> None:
    for word in VAGUE:
        start = low.find(word)
        while start != -1:
            end = start + len(word)
            while end < len(low) and low[end].isalpha():
                end += 1
            out.issues.append(Issue(
                "vague", f"'{text[start:end]}' cannot be checked: state a measurable value.",
                (start, end), "[укажите измеримое значение]",
            ))  # fmt: skip
            start = low.find(word, end)


def _missing(low: str, out: Result) -> None:
    for family, (keys, params) in FAMILIES.items():
        if any(k in low for k in keys):
            out.family = family
            for param, hints in params:
                if not any(h in low for h in hints):
                    out.issues.append(Issue(
                        "missing_parameter", f"No {param.replace('_', ' ')} stated for {family}."
                    ))  # fmt: skip
            return


def _conflicts(out: Result) -> None:
    stds = {s.split("-")[0] for s in out.standards}
    for a, b, why in CONFLICTS:
        if stds & a and stds & b:
            out.issues.append(Issue("conflicting_standards", why))


def _duplicates(out: Result) -> None:
    seen: dict[tuple[str, str], str] = {}
    for r in out.requirements:
        key = (r.name, r.comparator)
        if key in seen and seen[key] != r.value:
            message = f"'{r.name}' is given as both {seen[key]} and {r.value}."
            out.issues.append(Issue("duplicate_parameter", message, r.span))
        seen.setdefault(key, r.value)


def _suggest(text: str, out: Result) -> str:
    """The text with each fixable span replaced, right to left so offsets stay valid."""
    fixes = sorted(
        (i for i in out.issues if i.span and i.suggestion),
        key=lambda i: i.span[0] if i.span else 0,
        reverse=True,
    )
    result, last = text, len(text) + 1
    for i in fixes:
        s, e = i.span  # type: ignore[misc]
        if e > last:  # overlapping fixes: keep the later one
            continue
        result = result[:s] + str(i.suggestion) + result[e:]
        last = s
    return result
