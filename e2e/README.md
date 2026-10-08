# e2e

Playwright suites, visual baselines, accessibility checks.

**Public interface:** `pnpm e2e` from the repo root. The config starts the API (:8000) and web (:3000) itself.
- `tests/smoke.spec.ts`: redirect, all three locales render, web reaches API, zero axe WCAG 2.2 AA violations; desktop + phone projects.

**Rules:** every phase adds its journeys here; visual baselines are committed (from M1).
