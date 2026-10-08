# packages/ui

Shared components. Tailwind v4 classes only; colours, spacing and radii come from
`@qazsupply/design-tokens` (mapped to Tailwind theme names in `apps/web/app/globals.css`).
Every component is exercised in `apps/web/app/[locale]/gallery`.

**Public interface (M1)**
- `lib/utils` — `cn(...)` class merge.
- `components/button` — `Button` + `buttonVariants` (primary, secondary, ghost, danger).
- `components/card` — `Card`, `CardHeader`, `CardTitle`, `CardBody`.
- `components/badge` — `Badge` (neutral, risk, ok, gold, accent).
- `components/states` — `EmptyState`, `LoadingState`, `ErrorState`.
- `components/kpi` — `Kpi` count-up (instant under reduced motion).
- `components/probability-bar` — `ProbabilityBar` (p10/p50/p90 band, P(by promise); never a single date).
- `components/timeline` — `Timeline` (source + confidence per event; conflicts de-emphasised without lowering contrast).
- `components/finding-card` — `FindingCard` with an Evidence entry point.
- `components/data-table` — `DataTable` (keyboard-sortable, `aria-sort`, tabular figures).
- `components/evidence-drawer` — `EvidenceDrawer` (vaul side drawer: meta -> computation -> source rows).
- `components/ask-bar` — `AskBar` (read-only; disabled state carries the reason).
- `components/command-palette` — `CommandPalette` (cmdk).
- `components/toast` — `AppToaster` + `toast` (sonner).
- `components/charts` — `PriceVariancePlot`, `ConcentrationPareto`, `EtaBandChart`; each has an
  `aria-label` image role and a table alternative.

**Accessibility notes**
- Colour is never the only signal; badges and status always carry text.
- Scrollable regions must be keyboard-reachable (axe `scrollable-region-focusable`). The source-rows
  region in the evidence drawer sets `tabIndex={0}`; biome's `noNoninteractiveTabindex` is disabled
  for that file because axe requires it (see `biome.json` `overrides`).

**Not built yet:** shadcn sheet/dialog wrappers beyond the drawer, and a Storybook instance
(the gallery page covers every state for now).

**OSS decisions**
- Integrated: `vaul` (drawer), `sonner` (toasts), `cmdk` (command palette), `recharts` (charts).
- **Dropped:** `@tanstack/react-table` — v9 replaced the v8 API with a feature-slot model
  (`tableFeatures`/`useTable`) while the v8-compatible `legacy` entry is deprecated. Re-evaluate
  at M2 when tables become data-heavy; `DataTable` is a small headless component until then.
