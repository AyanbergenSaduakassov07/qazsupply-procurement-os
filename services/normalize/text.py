"""Deterministic text normalisation for item matching (ru / kk / Latin).

Both the purchase line and every classifier name go through `tokens()`, so comparisons
happen in one folded space:
- Kazakh-specific letters fold to their Russian look-alikes (ә->а, қ->к, ...): exports often
  type Kazakh without them, so folding both sides makes "Нитрилди" equal "Нитрилді".
- Latin transliteration ("perchatki nitrilovye") is converted back to Cyrillic.
- Packaging and paperwork noise ("уп. 100 шт", "р-р 10", "ГОСТ", "№5") is dropped.
- Common domain abbreviations are expanded (х/б); dotted truncations ("нитрил.") are kept
  as prefixes and matched by the scorer.
- Russian and Kazakh inflection is folded with a light suffix stripper (no dictionary).
"""

import re
from dataclasses import dataclass

KK_FOLD = str.maketrans("әғқңөұүһіё", "агкноуухие")

# Longest digraphs first so "sch" wins over "s"+"ch".
LATIN_TO_CYR = [
    ("sch", "щ"),
    ("zh", "ж"),
    ("kh", "х"),
    ("ts", "ц"),
    ("ch", "ч"),
    ("sh", "ш"),
    ("yu", "ю"),
    ("ya", "я"),
    ("yo", "е"),
    ("a", "а"),
    ("b", "б"),
    ("v", "в"),
    ("g", "г"),
    ("d", "д"),
    ("e", "е"),
    ("z", "з"),
    ("i", "и"),
    ("y", "ы"),
    ("k", "к"),
    ("l", "л"),
    ("m", "м"),
    ("n", "н"),
    ("o", "о"),
    ("p", "п"),
    ("r", "р"),
    ("s", "с"),
    ("t", "т"),
    ("u", "у"),
    ("f", "ф"),
    ("h", "х"),
    ("c", "к"),
    ("w", "в"),
    ("x", "кс"),
    ("j", "дж"),
]

# Real-world shorthand in Russian procurement exports (domain knowledge, not item-specific).
SHORTHAND = {"х/б": "хлопчатобумажные", "х\\б": "хлопчатобумажные", "диз": "дизельное"}
# Standard Russian procurement acronyms (general vocabulary, expanded before tokenising).
ACRONYMS = {
    "тбо": "твердых бытовых отходов",
    "то": "техническое обслуживание",
    "дт": "дизельное топливо",
    "пц": "портландцемент цемент",
    "сиз": "средства индивидуальной защиты",
    "гсм": "горюче-смазочные",
    "led": "светодиодная",
}
UNIT_SUFFIX = re.compile(r"^(\d+(?:\.\d+)?)(л|l|кг|kg|kг|мм|mm|м|m|вт|w|шт|a|а|в|v)$")

NOISE = re.compile(
    r"\(?\bпо\s+гост\b\)?|\bгост\b[\s\d.\-]*|\bуп\.?\s*\d*\s*(шт\.?)?|\bр-р\s*\S+|№\s*\d+"
    r"|\bкор\.?|\bимпорт\w*|\(?\bаналог\w*\)?|\b\d+\s*сорт\w*|\bкомплект\w*",
    re.IGNORECASE,
)
# Model codes (м12, 3х2,5, 15w-40) compare in one script: Cyrillic look-alikes -> Latin.
CODE_CANON = str.maketrans("авеклмнорстхуь", "abeklmhopctxyb")
SIZE_TOKEN = re.compile(r"^(xs|s|m|l|xl|xxl)$")
TOKEN = re.compile(r"[a-zа-я0-9]+(?:[.,х/-][a-zа-я0-9]+)*\.?")
SUFFIXES = sorted(
    [
        "ыми",
        "ими",
        "ого",
        "его",
        "ому",
        "ему",
        "ые",
        "ый",
        "ая",
        "ое",
        "ие",
        "ий",
        "ой",
        "ов",
        "ев",
        "ей",
        "ам",
        "ям",
        "ах",
        "ях",
        "ом",
        "ем",
        "ую",
        "юю",
        "ия",
        "ья",
        "а",
        "я",
        "ы",
        "и",
        "о",
        "е",
        "у",
        "ю",
        "лар",
        "лер",
        "дар",
        "дер",
        "тар",
        "тер",
        "ы",
        "ын",
        "ин",
        "ны",
        "ни",
        "сы",
        "си",
        "ды",
        "ди",
        "ты",
        "ти",
        "ға",
        "ге",
        "қа",
        "ке",
    ],
    key=len,
    reverse=True,
)
STOPWORDS = {"для", "по", "в", "на", "и", "с", "из", "арналған", "the", "for"}


@dataclass(frozen=True)
class Token:
    text: str  # folded, unstemmed (keeps numbers like 6205, м12, 3х2,5)
    stem: str
    is_prefix: bool  # written as a truncation ("нитрил.")
    is_number: bool


def _latin_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    return sum(c.isascii() for c in letters) / len(letters) if letters else 0.0


def _to_cyrillic(text: str) -> str:
    out, i = [], 0
    while i < len(text):
        for lat, cyr in LATIN_TO_CYR:
            if text.startswith(lat, i):
                out.append(cyr)
                i += len(lat)
                break
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def stem(word: str) -> str:
    if len(word) <= 4 or any(c.isdigit() for c in word):
        return word
    for suffix in SUFFIXES:
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            return word[: -len(suffix)]
    return word


def fold(text: str) -> str:
    """Lowercase, fold Kazakh look-alikes, and convert Latin-script lines to Cyrillic."""
    text = text.lower().translate(KK_FOLD)
    if _latin_ratio(text) > 0.6:
        # Keep model codes like 15w-40 / m12 readable: transliterate only alphabetic runs.
        text = re.sub(
            r"[a-z]+", lambda m: m.group(0) if _is_code(m, text) else _to_cyrillic(m.group(0)), text
        )
    return text


def _is_code(match: re.Match[str], text: str) -> bool:
    start, end = match.span()
    before = text[start - 1] if start else " "
    after = text[end] if end < len(text) else " "
    return before.isdigit() or after.isdigit()


def tokens(text: str) -> list[Token]:
    text = fold(text)
    for short, full in SHORTHAND.items():
        text = re.sub(rf"(?<!\w){re.escape(short)}\.?(?!\w)", full, text)
    for short, full in ACRONYMS.items():
        text = re.sub(rf"(?<!\w){short}(?!\w)", full, text)
    text = NOISE.sub(" ", text)
    out: list[Token] = []
    for raw in TOKEN.findall(text):
        is_prefix = raw.endswith(".") and not raw[:-1].replace(",", "").isdigit()
        word = raw.rstrip(".")
        if not word or word in STOPWORDS or SIZE_TOKEN.match(word):
            continue
        is_number = any(c.isdigit() for c in word)
        if is_number:
            word = word.replace("kh", "x").translate(CODE_CANON).replace(",", ".")
            # 15w-40 == 15w40, литол-24 == литол24; keep digit-digit hyphens (6310-2rs).
            word = re.sub(r"(?<=[a-zа-я])-(?=[a-z0-9])|(?<=[0-9])-(?=[a-zа-я])", "", word)
            if unit := UNIT_SUFFIX.match(word):
                word = unit.group(1)  # 19л == 19
        out.append(Token(word, word if is_number else stem(word), is_prefix, is_number))
    return out
