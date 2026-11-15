# Design system: recommendation and reconciliation

Run: `ui-ux-pro-max --design-system "B2B procurement logistics enterprise dashboard trust-critical data-dense compliance"` on 2026-10-08. Our tokens (docs/design/design-system.md) win unless they fail accessibility; every deviation is listed with its reason.

## What the tool recommended
| Area | Recommendation |
|---|---|
| Pattern | Real-time / operations: status colours (green/amber/red), data-dense but scannable |
| Style | "Trust & Authority": credentials visible, case studies with metrics, light + dark full support, WCAG AAA-capable |
| Colours | Primary #1E40AF, secondary #3B82F6, accent #D97706, background #F8FAFC, foreground #1E3A8A, destructive #DC2626 |
| Type | Fira Code headings + Fira Sans body |
| Avoid | Playful design, hidden credentials, AI purple/pink gradients |

## Reconciliation
| Decision | Ours | Tool | Verdict and reason |
|---|---|---|---|
| Palette | frost / ink / tengri / gold / risk / ok | blue + amber | **Keep ours.** Same structure (cool primary, warm accent, status set); ours carries the brand. |
| Primary text colour | ink #101418 on frost: **16.31:1** | navy foreground | Keep ink. |
| tengri as text/links | #0A8FB4 on frost: **3.31:1 (fails 4.5)** | | **Deviation:** add `tengri-700 #076F8C` (5.06:1 on frost, 5.74 on white) for text, links and focus rings. Brand tengri stays for large display (>= 24px, needs 3:1: passes) and non-text fills. |
| Primary button | white on tengri: **3.75:1 (fails)** | white on #1E40AF | **Deviation:** button fill `tengri-800 #065E77` with white text (7.3:1). |
| gold as text | #C9A227 on frost: **2.13:1 (fails)** | amber accent adjusted for 3:1 | **Deviation:** gold is never text on light surfaces. Use `gold-800 #7A6114` (5.22:1) for text; gold fill only with ink text (7.65:1) or as a non-text accent (savings highlight bar). |
| risk text | #C23B32 on frost: 4.67:1 | | Passes; keep. Always paired with icon + label. |
| ok text | #2E7D5B on frost: **4.41:1 (fails narrowly)** | | **Deviation:** on frost use `ok-700 #276B4E` for text (to verify in M1 contrast test); #2E7D5B fine on white (5.00:1). |
| Fonts | One family, tabular figures, full Kazakh Cyrillic | Fira Code + Fira Sans | **Reject the mono heading.** docs/design/design-system.md requires one family; mono headings read as "developer tool", which works against the trust goal. Candidates (all declare `cyrillic-ext` on Google Fonts, checked via google/fonts METADATA.pb): **Inter, IBM Plex Sans, Fira Sans, PT Sans, Golos Text, Noto Sans, Roboto**. Declaring the subset is not proof that all of ә ғ қ ң ө ұ ү һ і are drawn, so QS-006 runs a glyph-coverage and tabular-figure test before adoption. Recommendation to test first: **IBM Plex Sans** (tabular figures, neutral, strong Cyrillic) then **Inter**. |
| Style | Liquid Glass on nav/control layer only | Trust & Authority | Compatible. Glass never on content; "reduce transparency" fallback = opaque frost. |
| Effects | Motion via anime.js v4, 150-300 ms | "metric pulse, certificate carousel" | **Reject carousel and pulse loops** (motion without meaning; distracting in a trust product). Keep count-up for KPIs (reduced-motion = instant). |
| Dark mode | M1 | Full | Agree; design both together, test contrast separately. |

## Charts (per data job)
Price variance -> dot/range plot; concentration -> Pareto bar + cumulative line; spend over time -> line; ETA -> probability band + P(by date) bar; border queue -> line with "no data" gaps shown as gaps. All charts: direct labels, patterns not just colour, table alternative, locale number formats.

## Breakpoints and density
375 / 768 / 1024 / 1440. Coordinators on phones: logistics screens are designed mobile-first. Analysts on desktop: tables have a compact density option. Touch targets >= 44 px.
