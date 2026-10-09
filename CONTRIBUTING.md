# Contributing

Read `CLAUDE.md` (rules), `CONTEXT.md` (vocabulary) and the spec for your change first. Agents follow the same rules plus `docs/runbooks/agent-harness.md`.

## Setup
Node 24 (`.nvmrc`, corepack provides pnpm), uv, Docker, Supabase CLI.

```bash
make dev        # install, start local Supabase, run web :3000 + API :8000
make check      # lint, typecheck, unit + contract tests
make rls        # pgTAP suites, advisor lints, API isolation tests
make e2e        # Playwright on desktop / tablet / phone
```
Local test users live in `infra/supabase/seed.sql` and `e2e/fixtures/users.json`. Never use real client data anywhere in the repo, tests, logs or evals.

## Workflow
1. Branch from `main`: `feat/<ticket>-<slug>`, `fix/...`, `chore/...`, `docs/...`.
2. Commits follow Conventional Commits (`feat(ingest): ...`); the `commit-msg` hook enforces it.
3. Keep PRs small and vertical (DB -> service -> API -> UI -> e2e). One ticket per PR.
4. Open the PR with the template. "What was NOT verified" and "UNVERIFIED assumptions" are mandatory.
5. Squash-merge after CI is green and the owner approved. The branch is deleted on merge.

## Where things go
| You are adding | Do this |
|---|---|
| A table | Migration in `infra/supabase/migrations/` with `org_id`, RLS, explicit grants, covering indexes; the pgTAP suite picks it up automatically; `make advisors` must stay clean. Global reference data: ADR 0006. |
| An API route | Thin handler in `services/gateway/app.py`; logic in a module's `api.py`; regenerate the client (`pnpm --filter @qazsupply/api-client run generate`); add an isolation test. |
| A module | `services/<name>/` with a README stating its public interface; other modules import only `services.<name>.api` (enforced by `services/test_boundaries.py`). |
| A data source | Row in `docs/compliance/data-sources.md` first (id = folder name), then `connectors/<id>/` with fixtures and a contract test. |
| An LLM task | Prompt file `services/llm/prompts/<task>/v1.txt`, a golden set in `evals/`, calls only through `services.llm.Gateway`. No figure may come from a model. |
| UI text | Keys in `packages/i18n/messages/{ru,kk,en}.json` (parity is tested). Formal register; see `docs/design/brand-voice.md`. |
| A component | `packages/ui`, tokens only from `packages/design-tokens`, motion via `packages/motion` (reduced-motion safe), plus a gallery entry with every state. |
| A dependency | Exact version, at least 14 days old, allowed licence (`scripts/license_check.py`). |
| A decision | ADR in `docs/adr/` (supersede, never rewrite). |

## Definition of done
Tests green; RLS tested; advisors clean; no hard-coded strings; Evidence ids on every number; e2e + visual baselines updated; ADR / CONTEXT updated; PR lists what was not verified.
