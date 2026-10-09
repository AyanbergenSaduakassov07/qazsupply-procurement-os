# Tech-debt register

Budget: 20% of each phase (docs/product/prioritization.md). A phase gate cannot pass with an open item marked **blocker**. Close items by PR; keep closed rows for history.

| # | Item | Why it exists | Fix when | Status |
|---|---|---|---|---|
| D1 | Single root `pyproject.toml` | Modular monolith (ADR 0001); no conflicting deps yet | A module needs a conflicting dependency | open |
| D2 | Module boundaries by convention only | No import-linter | M1 | **closed** (M1: `services/test_boundaries.py`) |
| D3 | Web app without Tailwind/shadcn shell | M0 scope | M1 | **closed** (M1) |
| D4 | `httpx` deprecation warning in Starlette TestClient | Swap to `httpx2` was blocked by tooling review | With the Anthropic SDK adapter (M2), which already depends on httpx2 | open |
| D5 | No automated dependency bumps | M0 scope | M1 | **closed** (M1: Dependabot with 14-day cooldown) |
| D6 | Licence scan from package metadata, not file-level ScanCode | Lightweight first gate | Before the first vendored repo | open |
| D7 | `/health` without DB check | M0 scope | M1 | **closed** (M1) |
| D8 | Advisors run locally (splinter), not on a remote project | No remote Supabase project yet (owner decision: region, cost) | When the project exists: run `get_advisors` after each migration | open, **blocker for first client** |
| D9 | Audit times shown in Asia/Almaty for everyone | No user profile / time-zone preference | M3 (report surface) | open |
| D10 | Access token refresh only in `proxy.ts`; no session revocation list | Supabase handles revocation on refresh | M3 | open |
| D11 | Anthropic provider adapter not built | M1 makes no model calls | M2 with the first prompt + eval | open |
| D12 | Kazakh microcopy not reviewed by a native speaker | No reviewer yet | Before first kk-speaking client | open, **blocker for kk launch** |
| D13 | `style-src 'unsafe-inline'` in CSP | SSR'd inline style attributes from UI primitives | When primitives move to class-only positioning | open |
| D14 | Branch protection not enforced by GitHub | Private repo on GitHub Free; rulesets need a paid plan | When the repo moves to an organization plan | open |
