# Throwaway prototypes (M0, M3)

Open the HTML files directly in a browser. Fake data. Not production code. Delete once M1/M3/M6 build the real components.

| Prototype | Question | What it settles (pending owner + user test) |
|---|---|---|
| `evidence-drawer.html` | Drawer or modal? What goes first? | **Side drawer**, figure stays visible behind a light scrim; order = title -> meta (method, confidence, reviewer, version) -> "how computed" in words -> source rows. Deep-linkable `?evidence=<id>`; focus moves to the drawer and returns to the figure on close; Esc closes. |
| `shipment-timeline.html` | How do we show provenance and uncertainty on a phone? | Vertical timeline grouped by Leg; source badge + confidence per event; **conflicting events shown greyed with the rule that overrode them**; ETA as an 80% band against the promise line + P(by promised date); "delayed" is a chip, not a status; "why / what changed" disclosure. |
| `report-layouts.html` (M3) | Which report layout gets a CFO from headline to the biggest finding's evidence fastest, on screen and on paper? | **A. Narrative column**: headline saving -> findings ranked by money then confidence, each with its recommended action -> "what to do" summary. Rationale: (1) it follows the CFO's top task in reading order (persona 2: headline, then the biggest finding); (2) one column paginates into an identical PDF, while a 4-column grid does not; (3) every figure sits next to the sentence that explains it, so "where did the 4% go?" has an answer on the page; (4) B's KPI tiles split one story into four numbers with no ranking. B's useful part, savings by type, is kept as one chart with a table alternative below the ranking. |

Checks run (2026-10-08): axe (WCAG 2.2 AA tags) on a 390 x 844 viewport: **0 violations** for both, with the drawer open. Keyboard: Tab/Enter opens the drawer, Esc closes it, focus trap works.
Not tested: real users, screen reader by ear (VoiceOver/NVDA), dark mode, kk/en text expansion.

Open questions to test with users: is "34%" understood, or would "1 in 3" be better? Should ignored events be hidden behind a toggle by default?

M3 check (2026-10-12): axe (WCAG 2.2 AA tags) at 390 x 844 on `report-layouts.html`: **0 violations** for layout A and layout B. Not tested with real CFOs.
