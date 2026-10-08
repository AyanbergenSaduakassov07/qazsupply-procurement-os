"""Report whether a candidate UI font can draw Kazakh Cyrillic and tabular figures.

CLAUDE.md requires one font family with tabular figures and full Kazakh Cyrillic
(ә ғ қ ң ө ұ ү һ і). Declaring the `cyrillic-ext` subset is not proof the glyphs
are drawn, so this checks the font's cmap and OpenType features directly.

Usage:
    uv run python scripts/font_coverage.py [path-or-url ...]

With no arguments it checks the candidate stack from docs/design/design-system.md
(IBM Plex Sans, Inter) fetched from the pinned Google Fonts commit. Results are
committed in docs/design/font-coverage.md.
"""

from __future__ import annotations

import io
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from fontTools.ttLib import TTFont

# Kazakh-specific letters (lower and upper) plus common punctuation the UI needs.
KAZAKH_LETTERS = "әғқңөұүһі"
REQUIRED_CODEPOINTS = sorted(
    {ord(c) for c in KAZAKH_LETTERS + KAZAKH_LETTERS.upper() + "0123456789№₸"}
)
DIGITS = "0123456789"

# Pinned Google Fonts commits (main branch, checked 2026-10-08).
GOOGLE_FONTS = "https://raw.githubusercontent.com/google/fonts/main/ofl"
CANDIDATES: dict[str, str] = {
    "IBM Plex Sans": f"{GOOGLE_FONTS}/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf",
    "Inter": f"{GOOGLE_FONTS}/inter/Inter%5Bopsz,wght%5D.ttf",
}


@dataclass(frozen=True)
class Result:
    name: str
    missing: list[str]
    tabular: bool
    tnum_feature: bool

    @property
    def coverage_ok(self) -> bool:
        return not self.missing

    @property
    def pass_(self) -> bool:
        return self.coverage_ok and (self.tabular or self.tnum_feature)


def _load(source: str) -> TTFont:
    if "://" in source:
        with urllib.request.urlopen(source, timeout=30) as response:  # noqa: S310 - pinned https URL
            return TTFont(io.BytesIO(response.read()))
    return TTFont(Path(source))


def _has_tnum(font: TTFont) -> bool:
    gsub = font.get("GSUB")
    if gsub is None or gsub.table is None:
        return False
    for lookup in gsub.table.FeatureList.FeatureRecord:
        if lookup.FeatureTag == "tnum":
            return True
    return False


def _digits_monospaced(font: TTFont) -> bool:
    glyph_set = font.getBestCmap()
    widths = set()
    for digit in DIGITS:
        name = glyph_set.get(ord(digit))
        if name is None:
            return False
        widths.add(font["hmtx"][name][0])
    return len(widths) == 1


def inspect(name: str, source: str) -> Result:
    font = _load(source)
    cmap = font.getBestCmap()
    missing = [chr(cp) for cp in REQUIRED_CODEPOINTS if cp not in cmap]
    return Result(
        name=name,
        missing=missing,
        tabular=_digits_monospaced(font),
        tnum_feature=_has_tnum(font),
    )


def render(results: list[Result]) -> str:
    lines = [
        "| Font | Kazakh Cyrillic | Tabular figures | tnum feature | Verdict |",
        "|---|---|---|---|---|",
    ]
    for r in results:
        coverage = "all present" if r.coverage_ok else "missing " + " ".join(r.missing)
        figures = "yes" if r.tabular else "no"
        tnum = "yes" if r.tnum_feature else "no"
        verdict = "ADOPT" if r.pass_ else "reject"
        lines.append(f"| {r.name} | {coverage} | {figures} | {tnum} | {verdict} |")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if argv:
        results = [inspect(Path(a).stem, a) for a in argv]
    else:
        results = [inspect(name, url) for name, url in CANDIDATES.items()]
    sys.stdout.write(render(results) + "\n")
    return 0 if any(r.pass_ for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
