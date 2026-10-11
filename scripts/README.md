# scripts

Developer and CI tooling. Run from the repo root; most are wrapped by a `make` target.

| Script | Make target | What it does |
|---|---|---|
| `advisors.sh` | `make advisors` (also in `make rls`) | Runs Supabase splinter lints (`sql/splinter.sql`, pinned) against the local DB; fails on WARN/ERROR |
| `e2e-visual.sh` | `make visual` | Renders or compares visual baselines inside the pinned Linux Playwright image, so pixels match CI |
| `lighthouse-a11y.sh` | `make lighthouse` | Lighthouse accessibility gate (>= 95) on key screens, signed in as the seeded client admin |
| `license_check.py` | CI `license-scan` | Fails on dependency licences outside its allowlist (policy: `docs/compliance/third-party-licenses.md`; locked surface) |
| `notices.py` | - | Regenerates `THIRD_PARTY_NOTICES.md` from shipped deps (prod JS + non-dev Python); `--check` fails when stale. Run after any dependency change |
| `vendor.py` / `vendor.sh` | - | `list`, `sync`, `check` for licence-tracked third-party source in `vendor/` |
| `font_coverage.py` | - | Checks a candidate font's cmap for full Kazakh Cyrillic and tabular figures |

Tests live next to the code (`test_*.py`).

**Rules:** see root `CLAUDE.md`. Scripts touch the LOCAL stack only; nothing here deploys or writes to a remote project.
