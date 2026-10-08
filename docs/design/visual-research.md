# Visual and competitive research (structure only)

Date: 2026-10-08. Rule: record patterns and why they work; copy no assets, code or branding.

## What was checked
- **21st.dev** (via fetch): data-table and timeline component listings. Names only, no layouts or licences on listing pages. Patterns observed in names: row expansion, column visibility, filter toolbars and filter builders, sorting + search, resizable/reorderable columns, cell selection, inline editing, table skeletons; timelines: vertical activity/audit logs, order-status cards, incident status timelines, milestone/changelog grouping by date, Gantt.
- **Dribbble** (logistics-dashboard, procurement-dashboard): **not captured.** Pages render client-side; plain fetch returned empty, the Chrome extension was not connected, and Playwright saw no shot content (likely bot protection). I didn't try to get around it. Owner can browse manually and add notes here.

## Patterns we adopt and why
| Pattern | Where | Why it works |
|---|---|---|
| Exception-first list with severity + owner + SLA | Shipments, review queue | Coordinators act on the few that matter; sorts work by urgency, not recency |
| Vertical event timeline with source badge + confidence per event | Shipment detail | Shows provenance inline; vertical scales on phones |
| Status card with "last updated by X at T" | Shipment list, dossier | Trust depends on freshness, not just state |
| Filter toolbar + saved filters + "why empty" explanation | All tables | Empty results are the top confusion point in data tools |
| Row expansion instead of navigation for detail | Findings, offers | Keeps comparison context |
| Sticky header + pinned first column | Offer comparison | Wide matrices stay readable |
| Side drawer for evidence (not modal) | Every number | Keeps the figure and its source visible together |
| Skeletons, not spinners, > 300 ms | Everywhere | Perceived speed, no layout shift |

## Anti-patterns we avoid
Map-first logistics dashboards (pretty, slow to act on; map is secondary with a table equivalent); KPI walls without drill-down; red/green-only status; glass on content; auto-playing carousels; "AI score" without factors.
