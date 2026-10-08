# Font glyph coverage (M1, QS-006)

Run: `uv run python scripts/font_coverage.py` on 2026-10-08. Method: read each
candidate's cmap for the Kazakh letters (ә ғ қ ң ө ұ ү һ і, lower and upper),
digits, `№` and `₸`; then check tabular figures (all digit advances equal, or a
`tnum` OpenType feature). Declaring the `cyrillic-ext` subset is **not** proof a
glyph is drawn, so the check reads the font tables directly.

Sources: pinned Google Fonts `main` files (IBM Plex Sans variable `[wdth,wght]`,
Inter variable `[opsz,wght]`).

| Font | Kazakh Cyrillic | Tabular figures (default) | tnum feature | Verdict |
|---|---|---|---|---|
| IBM Plex Sans | all present | yes | no | **ADOPT** |
| Inter | all present | no | yes | adopt as fallback |

## Decision

**IBM Plex Sans** is adopted as the product font (`--qs-font-family`): it draws
every required Kazakh glyph and its digits are monospaced by default, so tables
and KPI count-ups do not jitter without extra CSS. Inter remains the first
fallback; it also covers Kazakh but needs `font-variant-numeric: tabular-nums`
(or the `tnum` feature) to align figures.

Loaded via `next/font/google` with `subsets: ["latin", "cyrillic", "cyrillic-ext"]`
in `apps/web/app/[locale]/layout.tsx`; self-hosted by Next, no runtime request to
Google.

## Not verified

- Rendering by eye on device (macOS/iOS/Android system fallbacks if the web font
  fails to load); only font tables were inspected.
- Weight axis rendering at the chosen weights.
- Kazakh text expansion (length delta versus ru/en) — measured once real strings land.
