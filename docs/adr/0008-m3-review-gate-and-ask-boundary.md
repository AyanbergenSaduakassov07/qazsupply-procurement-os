# 0008. M3 review gate in the database, review console in apps/web, Ask data boundary

- Status: accepted
- Date: 2026-10-12
- Deciders: owner (approval policy, Ask data boundary, dev model provider, 2026-10-11/12); Claude (M3) for the rest

## Context
M3 must make an unreviewed report unreachable for clients "at DB, API and UI, each tested", let one person run audits for now (Q3: 1 builder), and add Ask, the first feature that sends tenant data to a model provider. Before M3 the database allowed any staff member to set `status = 'released'` directly; nothing tied release to an approving review.

## Decision
1. **The release flow is enforced in Postgres** (migration `20261012000000_m3_review_gate.sql`): status transitions are allowed only draft -> in_review -> approved -> released (or rejected / superseded). Approval needs a decision on every finding plus a report-level approval signed by the caller. Release stamps `released_by = auth.uid()`. Findings freeze once their report leaves draft. Each step is written to the audit chain by the trigger itself, so no client of the database can skip it. The API repeats the staff check (403) and maps rule violations to 409 with the same reason code. The UI shows only the actions the state allows.
2. **Approval policy (owner):** one reviewer may approve and release, as two separate logged steps. A per-organization `four_eyes` switch, changeable only by a QazSupply admin, makes the database refuse approval by the analysis runner and release by the approver.
3. **Client visibility:** a client sees a finding only in a released report and only if its latest decision is not `reject`. Rejected findings, their evidence and their notes stay hidden. Notes on kept findings are client-visible, and the console says so.
4. **The review console is a route group in `apps/web` (`/[locale]/review`)**, not a separate `apps/review` app as the M3 prompt sketched. It shares auth, CSP, i18n and the design system. Role gating comes from RLS and the API, with navigation hidden for client roles.
5. **Ask data boundary (owner):** Ask is off per organization until a client admin turns on `ask_enabled`. Only structured, finding-level tool results go to the model: type, item name, supplier name, amounts, Evidence ids. Raw uploaded rows never go, and BIN/IIN, emails and phones are redacted by the LLM gateway.
6. **Development model provider (owner):** an OpenRouter free model (`google/gemma-4-31b-it:free`, fallback `nvidia/nemotron-3-super-120b-a12b:free`; chosen 2026-10-12 as the free models with both tool calling and structured output) runs on synthetic data only, because free endpoints may log or train on prompts (UNVERIFIED). The key lives in the owner's `.env.local` only. Production stays on Claude via the Anthropic adapter (D11), behind the same `services/llm` gateway.

## Alternatives considered
- Enforce the flow only in the API: one missed code path, or a direct database client, could release an unreviewed report. Rejected; the database is the last line.
- Separate `apps/review` Next.js app: a second auth, CSP and i18n surface to secure and test for no user-facing gain at this size. Revisit if reviewers need a different deployment or domain.
- Four-eyes always on: safest, but it blocks every release while the owner is the only reviewer.
- Send source purchase lines to the model: better drill-down answers, but more commercial data leaves the boundary. Revisit per client with consent.

## Consequences
- Seeds, migrations and test fixtures run as privileged roles and bypass the guards (as with RLS). Application code must always run as `authenticated`.
- Content edits to findings after submission are impossible by design. A reviewer who disagrees with a number rejects the finding and re-runs the analysis.
- Monitor: the 409 reason codes in API logs (a spike in `undecided_findings` or `note_required` means the console is unclear).
