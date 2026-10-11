# Tech-debt register

Budget: 20% of each phase (docs/product/prioritization.md). A phase gate cannot pass with an open item marked **blocker**. Close items by PR; keep closed rows for history.

| # | Item | Why it exists | Fix when | Status |
|---|---|---|---|---|
| D1 | Single root `pyproject.toml` | Modular monolith (ADR 0001); no conflicting deps yet | A module needs a conflicting dependency | open |
| D2 | Module boundaries by convention only | No import-linter | M1 | **closed** (M1: `services/test_boundaries.py`) |
| D3 | Web app without Tailwind/shadcn shell | M0 scope | M1 | **closed** (M1) |
| D4 | `httpx` deprecation warning in Starlette TestClient | Swap to `httpx2` was blocked by tooling review | With the Anthropic SDK adapter (D11), which already depends on httpx2 | open |
| D5 | No automated dependency bumps | M0 scope | M1 | **closed** (M1: Dependabot with 14-day cooldown) |
| D6 | Licence scan from package metadata, not file-level ScanCode | Lightweight first gate | Before the first vendored repo | open |
| D7 | `/health` without DB check | M0 scope | M1 | **closed** (M1) |
| D8 | Advisors run locally (splinter), not on a remote project | No remote Supabase project yet (owner decision: region, cost) | When the project exists: run `get_advisors` after each migration | open, **blocker for first client** |
| D9 | Audit times shown in Asia/Almaty for everyone | No user profile / time-zone preference | M3 (report surface) | open |
| D10 | Access token refresh only in `proxy.ts`; no session revocation list | Supabase handles revocation on refresh | M3 | open |
| D11 | Anthropic provider adapter not built | M1 makes no model calls; M2 stayed deterministic (re-rank disabled, ADR 0007) | The first feature that calls a model (M3 explanations / Ask), with its prompt + eval | open |
| D12 | Kazakh microcopy not reviewed by a native speaker | No reviewer yet | Before first kk-speaking client | open, **blocker for kk launch** |
| D13 | `style-src 'unsafe-inline'` in CSP | SSR'd inline style attributes from UI primitives | When primitives move to class-only positioning | open |
| D14 | Branch protection not enforced by GitHub | Private repo on GitHub Free; rulesets need a paid plan | When the repo moves to an organization plan | open |
| D15 | FX rates and the ЕНС ТРУ sample are loaded from files, not a DB reference table | A new global table needs a change to the locked pgTAP structure test (separate harness PR) | Harness-change PR: add `fx_rates` / `enstru_codes` reference tables (ADR 0006) | open |
| D16 | Second (SQL) implementation covers price variance and outliers only | Repeat/split/concentration claim no saving or an explicit assumption | Before any of them produces a headline saving | open |
| D17 | M2 gates measured on synthetic data only | No real ЕНС ТРУ access, no owner-labelled lines, no hand-audited datasets | When the owner provides them: run `evals/matcher` and `evals/findings` on the real sets | open, **blocker for Gate A** |
| D18 | Matcher calibration fitted on synthetic data (realistic holdout abstains 46%) | Calibration needs real labelled lines | Refit `evals/matcher/train.py` on the owner's set | open |
| D19 | No separate cap on decompressed .xlsx size | openpyxl read-only streams rows; row/column caps bound memory | Before accepting files from untrusted external parties (supplier portal, M8) | **closed** (2026-10-11: `MAX_UNZIPPED` 256 MB declared-size cap, rejected as `too_large`) |
| D20 | Reviewer UI "choose" offers only the top-5 candidates; free search exists in the API (`/classifier`) but not in the UI | M2 scope | M3 review console | open |
| D21 | Ask is not streamed token by token | Every figure is validated before display (ADR 0008) | If users find the wait too long: stream only after validation, sentence by sentence from the server | open |
| D22 | Text-only prompt-injection hijacks (no digits, no link) depend on the model refusing | No structural rule can tell a false sentence from a true one | Measured live by `evals/ask`; add an LLM-judge pass or a sentence allowlist if the live rate is above 0 | open |
| D23 | Report PDF reads fonts from `node_modules` at runtime | Simplest path for `next start` | Before a standalone/serverless deploy: add the font files to `outputFileTracingIncludes` | open |
| D24 | Agent-ready MCP API and `packages/agent-skills` packs (M3 tie-in) not built | M3 slices went to the review gate, report, PDF and Ask first | Before Gate A evidence collection ends, or when a client asks for agent access | open |
| D25 | EDS sign-off via NCALayer not built | Counsel must first confirm legal effect and whether server-side signature validation is required (M3 prompt) | After counsel's written answer; audit-log approval is the fallback in use | open, needs owner |
| D26 | Kazakh microcopy for the review console, report, PDF and Ask (~115 strings) not reviewed by a native speaker | Same as D12 | Before the first kk-speaking client (D12) | open, **blocker for kk launch** (with D12) |
