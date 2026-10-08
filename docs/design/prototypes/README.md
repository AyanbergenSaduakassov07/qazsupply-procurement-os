# Throwaway prototypes (M0)

Open the HTML files directly in a browser. Fake data. Not production code. Delete once M1/M3/M6 build the real components.

| Prototype | Question | What it settles (pending owner + user test) |
|---|---|---|
| `evidence-drawer.html` | Drawer or modal? What goes first? | **Side drawer**, figure stays visible behind a light scrim; order = title -> meta (method, confidence, reviewer, version) -> "how computed" in words -> source rows. Deep-linkable `?evidence=<id>`; focus moves to the drawer and returns to the figure on close; Esc closes. |
| `shipment-timeline.html` | How do we show provenance and uncertainty on a phone? | Vertical timeline grouped by Leg; source badge + confidence per event; **conflicting events shown greyed with the rule that overrode them**; ETA as an 80% band against the promise line + P(by promised date); "delayed" is a chip, not a status; "why / what changed" disclosure. |

Checks run (2026-10-08): axe (WCAG 2.2 AA tags) on a 390 x 844 viewport: **0 violations** for both, with the drawer open. Keyboard: Tab/Enter opens the drawer, Esc closes it, focus trap works.
Not tested: real users, screen reader by ear (VoiceOver/NVDA), dark mode, kk/en text expansion.

Open questions to test with users: is "34%" understood, or would "1 in 3" be better? Should ignored events be hidden behind a toggle by default?
