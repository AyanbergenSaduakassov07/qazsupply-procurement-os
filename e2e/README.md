# e2e

Playwright suites on three viewports (`desktop`, `tablet` 820x1180 touch, `phone` Pixel 7), against the local Supabase stack with real sign-in.

**Public interface**
- `make e2e`: functional suites. Starts API (:8000) and web (:3000) itself unless `E2E_BASE_URL` is set.
- `make visual`: visual baselines, rendered in `mcr.microsoft.com/playwright:v1.63.0-noble` (same pixels as CI). Needs a production web build on :3000. Update with `scripts/e2e-visual.sh --update-snapshots`.
- `make lighthouse`: Lighthouse accessibility >= 95 on sign-in, overview, audit, settings, gallery (kk/ru/en).

**Suites**
- `auth.setup.ts`: signs in through the UI as client admin A, client user A and the reviewer; sessions go to `.auth/` (gitignored).
- `auth.spec.ts`: guard redirects, sign-in errors, keyboard-only sign-in journey, tenant isolation through the UI (forged org cookie ignored, Org B never rendered, API returns 404 with A's own token), role views, sign-out.
- `shell.spec.ts`: header controls, notifications, language/theme/reduce-transparency, skip link, mobile menu, reduced motion, audit/settings axe-clean.
- `gallery.spec.ts`: every component and state renders and is axe-clean.
- `visual.spec.ts`: sign-in, overview, audit x light/dark x kk/ru/en x three viewports (54 baselines in `tests/__screenshots__`).

**Test users:** `fixtures/users.json` mirrors `infra/supabase/seed.sql`. Local only, not real credentials.
