"""Explainable name matching for sanctions/PEP screening across kk, ru, en and Kazakh Latin.

Both sides are reduced to one Latin "skeleton": transliterate Cyrillic (incl. ә ғ қ ң ө ұ ү һ і),
strip diacritics, drop legal forms, fold spelling variants (ye/e, kh/h, j/zh, q/k, ...) and
patronymic endings (Нұрланқызы, Nurlanovna -> nurlan). Tokens are then aligned one to one with
RapidFuzz; the score and every aligned pair are returned so a human can see why it matched.
Screening favours recall: a missed sanctioned party is worse than a reviewed false positive.
"""

import re
import unicodedata
from dataclasses import dataclass, field

from rapidfuzz import fuzz

CYR = {
    "а": "a", "ә": "a", "б": "b", "в": "v", "г": "g", "ғ": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "i", "і": "i", "к": "k", "қ": "k", "л": "l", "м": "m",
    "н": "n", "ң": "n", "о": "o", "ө": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ұ": "u", "ү": "u", "ф": "f", "х": "kh", "һ": "h", "ц": "ts", "ч": "ch", "ш": "sh",
    "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}  # fmt: skip
LEGAL = {
    "too", "ooo", "ao", "pao", "zao", "ip", "zhshs", "llp", "llc", "ltd", "jsc", "inc",
    "gmbh", "fze", "fzco", "plc", "co", "corp", "company", "limited",
}  # fmt: skip
# Applied in order to the transliterated, lower-case text.
FOLDS = [
    # English spellings written phonetically in Cyrillic: Caspian/Каспиан, Lights/Лайтс.
    (r"c(?!h)", "k"), (r"gh", ""), (r"th", "z"),
    (r"shch", "sh"), (r"\bye", "e"), (r"\byo", "e"), (r"ya", "a"), (r"ia", "a"), (r"yu", "u"),
    (r"iu", "u"), (r"kh", "h"), (r"ts", "c"), (r"j", "zh"), (r"q", "k"), (r"w", "v"),
    (r"x", "ks"), (r"y", "i"), (r"ii", "i"), (r"(.)\1", r"\1"),
]  # fmt: skip
PATRONYMIC = re.compile(r"(ovich|evich|ovna|evna|uli|kizi)$")
MIN_TOKEN = 2
THRESHOLD = 80.0  # lowest-FP point with zero known misses on evals/screening (REPORT-M4.md)


def skeleton_tokens(name: str) -> list[str]:
    """'ТОО «Сапарова Айгүл Нұрланқызы»' -> ['saparova', 'aigul', 'nurlan']."""
    text = "".join(CYR.get(ch, ch) for ch in name.lower())
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    tokens = []
    for raw in re.split(r"[^a-z]+", text):
        if not raw or raw in LEGAL:
            continue
        tok = raw
        for pattern, repl in FOLDS:
            tok = re.sub(pattern, repl, tok)
        root = PATRONYMIC.sub("", tok)
        tok = root if len(root) >= 3 else tok
        if len(tok) >= MIN_TOKEN:
            tokens.append(tok)
    return tokens


@dataclass(frozen=True)
class Match:
    score: float
    pairs: list[tuple[str, str, float]] = field(default_factory=list)
    method: str = "skeleton_token_alignment"


def compare(query: str, candidate: str) -> Match:
    """Align query tokens to candidate tokens one to one (greedy, best ratio first).

    Score = mean ratio over the shorter side's tokens, so 'Saparova Aigul' still matches
    'SAPAROVA, Aigul Nurlanovna', but one shared surname out of three tokens does not.
    """
    q, c = skeleton_tokens(query), skeleton_tokens(candidate)
    if not q or not c:
        return Match(0.0)
    scored = sorted(
        ((fuzz.ratio(a, b), i, j) for i, a in enumerate(q) for j, b in enumerate(c)), reverse=True
    )
    used_q: set[int] = set()
    used_c: set[int] = set()
    pairs = []
    for ratio, i, j in scored:
        if i in used_q or j in used_c:
            continue
        used_q.add(i)
        used_c.add(j)
        pairs.append((q[i], c[j], round(ratio, 1)))
    short = min(len(q), len(c))
    # A single-token name ("Kim") is too weak alone: it must be the whole of both names.
    if short == 1 and max(len(q), len(c)) > 1:
        return Match(round(min(pairs[0][2], 60.0), 1), pairs)
    score = sum(p[2] for p in pairs[:short]) / short
    return Match(round(score, 1), pairs)


def best(query: str, names: list[str]) -> tuple[str, Match]:
    """The candidate alias that matches the query best."""
    return max(((n, compare(query, n)) for n in names), key=lambda nm: nm[1].score)
