# Agent harness: what Claude may do alone, what needs a human

Owner: Ayan. Enforced by `.claude/settings.json` (deny / ask lists), CI required checks, and branch protection. Prose here; machine rules there. When they disagree, the stricter one wins.

## Surfaces

| Surface | Examples | Rule |
|---|---|---|
| **Locked** | `evals/**` golden sets and scorers, `.github/workflows/**`, `infra/supabase/tests/**`, `connectors/_contract/**`, `scripts/license_check.py`, `vendor/**`, `CLAUDE.md` non-negotiables | Agent may propose changes **in a separate PR** labelled `harness-change`. It never scores its own work with an evaluator it changed in the same PR. |
| **Editable** | `apps/**`, `packages/**`, `services/**`, `connectors/<id>/**`, docs, new migrations (local) | Agent edits freely on a feature branch. |
| **Append-only** | `docs/adr/` (supersede, never rewrite), `audit_log`, `ShipmentEvent` streams, `evals/**/results*.jsonl`, `docs/runbooks/agent-thread.md` | Append; corrections are new entries. |
| **Human-controlled** | merge to `main`, prod migrations, deploys, secrets, external messages, money, legal text | Explicit human approval per action. |

## Unattended (no approval needed)
- Read the repo; run local tests, linters, type checks, Playwright against localhost.
- Create branches, commit on non-`main` branches, write specs/ADRs/tickets as **proposals**.
- Start/stop/reset the **local** Supabase stack (`supabase start|stop|test db --workdir infra`).
- Write new migration files and test them locally.
- Research with web search/fetch on public pages (no logins, no scraping behind auth).
- Create Supabase **preview branches** only after asking (in `ask` list).

## Requires explicit human approval (each time)
| Action | Why | Enforcement |
|---|---|---|
| Any migration against a remote/prod DB (`supabase db push`, MCP `apply_migration`, `execute_sql`) | Irreversible data change | `deny` in settings; human runs it |
| Merge to `main`, push to `main`, force-push, release | Governance | `deny`/`ask` + branch protection |
| Any external message: RFQ send, supplier/carrier email, Telegram, notification to clients | Reputation, legal | Product rule: AI drafts, human sends (CONTEXT.md) |
| Anything financial or legal: prices to a client, report release, financing/insurance flow, contract text, sanctions decision | Liability | Review gate in product; never automated |
| Sharing Miro boards / docs outside the owner | Confidentiality | `ask` |
| Adding a data source, model, or vendored repo | Licence | Register first (`data-sources.md`, `third-party-licenses.md`) |
| Reading `.env` / secrets | Least privilege | `deny` |

## Autonomous loops (e.g. matcher tuning in M2)
1. Objective in one sentence + locked evaluator (golden set + scorer) fixed at loop start (record its git SHA in the thread log).
2. Editable surface named explicitly (e.g. `services/normalize/matcher/**`).
3. Each attempt: checkpoint commit -> run evaluator -> append result row to `evals/<name>/results.jsonl` (per-dimension, not only aggregate) -> keep if better, else `git revert`.
4. Budget: wall clock and $ LLM spend per run (LLM gateway kill switch, `LLM_MONTHLY_BUDGET_USD`).
5. Output is a PR, never a merge. PR lists rejected attempts.

## Rollback procedure
| What broke | Rollback |
|---|---|
| Code on a branch | `git revert <sha>` (never rewrite shared history) |
| Merged change | Revert PR -> CI -> merge by human |
| Local DB | `supabase db reset --workdir infra` |
| Remote migration | Forward-fix migration written by agent, applied by human; restore from PITR backup only with owner approval. Every migration states its down path in a comment. |
| LLM misbehaviour in prod | `LLM_KILL_SWITCH=true` (services/llm), then investigate from `llm_calls` |
| Bad connector data | Disable connector flag; records keep `raw_sha256` + `fetched_at` so affected rows are found and re-derived |
| Leaked secret | Rotate first, then purge history; record in `docs/security/incidents/` |

## Durable state
Long sessions write a handoff to `docs/runbooks/agent-thread.md` (append-only): goal, done, failed, next, blockers. Chat history is not state.
