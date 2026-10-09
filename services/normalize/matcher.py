"""Item matcher: purchase-line text -> classifier code (ADR 0007).

Pipeline: tokens() -> RapidFuzz preselection -> token-level rescoring (prefix-aware, model
numbers must agree) -> calibrated confidence -> status:
  auto     confidence >= threshold; the code is applied
  review   below threshold; a human chooses (the candidates and reasons are shown)
  bundled  several items in one line (Q5 default: flag, never force a single code)
An optional re-ranker (LLM via services.llm) may only pick among the retrieved candidates.
"""

import json
import math
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

from rapidfuzz import fuzz, process

from services.normalize.text import Token, tokens

CALIBRATION = Path(__file__).parent / "calibration.json"
PRESELECT = 50
TOP_K = 5
BUNDLE_SPLIT = re.compile(r"\s\+\s|\s+и\s+|\s+және\s+|;")
BUNDLE_HINT = re.compile(r"комплект|набор|жиынтық|\+", re.IGNORECASE)


@dataclass(frozen=True)
class Entry:
    code: str
    names: tuple[str, ...]


@dataclass(frozen=True)
class Candidate:
    code: str
    score: float  # 0-100
    matched: tuple[str, ...]  # query tokens that matched, for the "why" in the review queue


@dataclass(frozen=True)
class MatchResult:
    status: str  # auto | review | bundled
    code: str | None
    confidence: float  # calibrated P(top-1 is correct)
    candidates: tuple[Candidate, ...] = field(default_factory=tuple)
    method: str = "lexical"


@dataclass(frozen=True)
class Calibration:
    """Logistic model on (top score, margin to 2nd). Fitted by evals/matcher/train.py."""

    w_score: float = 0.12
    w_margin: float = 0.05
    bias: float = -9.0
    threshold: float = 0.85
    # Evidence floor: below this score a human always decides, whatever the calibration says.
    min_auto_score: float = 70.0
    version: str = "default"

    def is_auto(self, top: float, margin: float) -> bool:
        return top >= self.min_auto_score and self.confidence(top, margin) >= self.threshold

    def confidence(self, top: float, margin: float) -> float:
        z = self.w_score * top + self.w_margin * margin + self.bias
        return 1 / (1 + math.exp(-z))

    @classmethod
    def load(cls, path: Path = CALIBRATION) -> "Calibration":
        return cls(**json.loads(path.read_text())) if path.exists() else cls()


def _token_sim(q: Token, c: Token) -> float:
    if q.is_number or c.is_number:
        if q.text == c.text:
            return 1.0
        # A model number matches its suffixed variants: 6205 ~ 6205-2rs, m12 ~ m12x60.
        tail = q.text[len(c.text) :]
        variant = tail[:1].isalpha() or tail[:1] in {"-", "/"}  # never a digit or decimal point
        return 1.0 if q.text.startswith(c.text) and variant and len(c.text) >= 3 else 0.0
    if q.is_prefix and len(q.stem) >= 3 and c.text.startswith(q.stem):
        return 1.0
    if q.stem == c.stem:
        return 1.0
    ratio = fuzz.ratio(q.stem, c.stem) / 100
    return ratio if ratio >= 0.75 else 0.0


def _score(
    query: Sequence[Token], name: Sequence[Token], entry_vocab: Sequence[Token]
) -> tuple[float, tuple[str, ...]]:
    """cover_c: how much of THIS name the line contains; cover_q: how much of the line is
    explained by ANY name of the same item (lines often mix ru and kk words)."""
    if not query or not name:
        return 0.0, ()
    words_q = [t for t in query if not t.is_number]
    words_c = [t for t in name if not t.is_number]
    vocab = [t for t in entry_vocab if not t.is_number]
    cover_c = sum(max((_token_sim(q, c) for q in words_q), default=0) for c in words_c)
    cover_q = sum(max((_token_sim(q, c) for c in vocab), default=0) for q in words_q)
    cover_c /= max(len(words_c), 1)
    cover_q /= max(len(words_q), 1)
    nums_q = [t for t in query if t.is_number]
    nums_c = [t for t in name if t.is_number]
    hits = sum(any(_token_sim(q, c) for q in nums_q) for c in nums_c)
    if nums_c and nums_q:
        factor = 1.05 if hits == len(nums_c) else (0.85 if hits else 0.5)
    elif nums_c:
        factor = 0.9  # candidate is a specific model, query did not say which
    else:
        factor = 1.0
    matched = tuple(q.text for q in query if any(_token_sim(q, c) > 0 for c in entry_vocab))
    # Containing the item's name matters more than extra spec words (exports always add them).
    return min(100.0, 100 * (0.8 * cover_c + 0.2 * cover_q) * factor), matched


class Matcher:
    def __init__(
        self,
        entries: Sequence[Entry],
        calibration: Calibration | None = None,
        reranker: Callable[[str, Sequence[Candidate]], str | None] | None = None,
    ) -> None:
        self._entries = list(entries)
        self._cal = calibration or Calibration.load()
        self._rerank = reranker

    @cached_property
    def _index(self) -> list[tuple[int, list[Token], str]]:
        rows = []
        for i, entry in enumerate(self._entries):
            for name in entry.names:
                toks = tokens(name)
                rows.append((i, toks, " ".join(t.stem for t in toks)))
        return rows

    @cached_property
    def _vocab(self) -> dict[int, list[Token]]:
        vocab: dict[int, list[Token]] = {}
        for i, toks, _ in self._index:
            vocab.setdefault(i, []).extend(toks)
        return vocab

    def candidates(self, text: str) -> list[Candidate]:
        query = tokens(text)
        if not query:
            return []
        q_str = " ".join(t.stem for t in query)
        pre = process.extract(
            q_str, [r[2] for r in self._index], scorer=fuzz.token_set_ratio, limit=PRESELECT
        )
        best: dict[int, Candidate] = {}
        for _, _, row_idx in pre:
            entry_idx, name_toks, _ = self._index[row_idx]
            score, matched = _score(query, name_toks, self._vocab[entry_idx])
            code = self._entries[entry_idx].code
            if entry_idx not in best or score > best[entry_idx].score:
                best[entry_idx] = Candidate(code, round(score, 1), matched)
        return sorted(best.values(), key=lambda c: (-c.score, c.code))[:TOP_K]

    def _is_bundle(self, text: str) -> bool:
        if not BUNDLE_HINT.search(text):
            return False
        parts = [p for p in BUNDLE_SPLIT.split(text) if p.strip()]
        if len(parts) < 2:
            return False
        codes = {c[0].code for p in parts if (c := self.candidates(p)) and c[0].score >= 60}
        return len(codes) >= 2

    def match(self, text: str) -> MatchResult:
        cands = tuple(self.candidates(text))
        if self._is_bundle(text):
            return MatchResult("bundled", None, 0.0, cands)
        if not cands:
            return MatchResult("review", None, 0.0, ())
        top = cands[0].score
        margin = top - (cands[1].score if len(cands) > 1 else 0.0)
        conf = round(self._cal.confidence(top, margin), 3)
        if self._cal.is_auto(top, margin):
            return MatchResult("auto", cands[0].code, conf, cands)
        if self._rerank is not None:
            chosen = self._rerank(text, cands)
            # The model may only choose among retrieved codes; anything else is ignored.
            if chosen in {c.code for c in cands}:
                return MatchResult("review", chosen, conf, cands, method="lexical+rerank")
        return MatchResult("review", cands[0].code, conf, cands)
