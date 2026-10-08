# QazSupply AI

AI procurement, supplier-vetting and shipment-control platform for Kazakhstan and Central Asia.

> **Status: M0 done (harness + blueprint), awaiting owner review.** No product features yet. Next: answer Q1-Q6 (`ROADMAP.md`), then prompt **M1**.

## What it is

Three products on one platform:

1. **Spend X-ray (the auditor):** upload purchase history, get evidence-backed findings on overpaying, split purchases and supplier concentration. A human expert reviews every report before the client sees it.
2. **Supplier 360 and Procurement OS (the detective):** supplier dossiers, sanctions and beneficial-owner screening, RFQs, offer comparison, technical-spec checks, catalogue with analogs.
3. **Logistics Control Tower and Risk Radar:** multi-source shipment tracking, probabilistic ETA, border-queue forecasts, reroute options, and alerts linked to your suppliers and orders.

Later: supplier marketplace, group purchases, financing and insurance referrals, digital batch passport, regional expansion (Uzbekistan, Kyrgyzstan).

## Non-negotiable principles

1. SQL and Python compute every number. The LLM reads text, extracts fields and explains. No figure without an Evidence id.
2. AI prepares and flags; a human decides and signs.
3. Only legal and open data sources, or sources with a recorded licence.
4. Multi-tenant by design: row-level security on every table, each policy tested.
5. All external text (supplier files, news, emails, PDFs) is untrusted.

Full rules: [`CLAUDE.md`](CLAUDE.md). Vocabulary: [`CONTEXT.md`](CONTEXT.md).

## Repository layout

```text
QazSupply/
├─ CLAUDE.md            # rules and skill routing for Claude Code
├─ CONTEXT.md           # domain glossary (ubiquitous language)
├─ ROADMAP.md           # 5-year phases and quality gates
├─ docs/                # adr, specs, prompts, runbooks, compliance, research, design, security
├─ apps/                # web, review, supplier-portal, marketing   (Next.js)
├─ packages/            # ui, design-tokens, motion, i18n, api-client, config, agent-skills
├─ vendor/              # third-party source we own as native code (pinned, licence-tracked)
├─ services/            # Python deep modules (ingest ... logistics ... finance)
├─ connectors/          # one adapter per external source, with fixtures
├─ evals/               # golden sets and scorers
├─ e2e/                 # Playwright suites
├─ infra/               # Supabase migrations, docker, terraform, CI
└─ scripts/             # loaders, seeds, anonymizers
```

Every folder has a `README.md` stating its purpose and public interface.

## Open-source building blocks

226 unique GitHub repos were verified on 2026-10-08 (exists, licence, last commit, pinned SHA) and mapped to the prompts that use them: see [`docs/research/oss-catalog.md`](docs/research/oss-catalog.md). Licence policy and register: [`docs/compliance/third-party-licenses.md`](docs/compliance/third-party-licenses.md). Vendoring workflow: [`vendor/README.md`](vendor/README.md).

## Stack (planned)

Next.js, React, Tailwind, shadcn, anime.js v4 | FastAPI and Python workers | Postgres with pgvector and RLS (Supabase) | Claude API behind an LLM gateway | Playwright for end-to-end tests.

## How to work in this repo

1. Open the folder in Claude Code. `CLAUDE.md` loads automatically.
2. Run the prompts in order from `docs/prompts/` (M0 to M9). Do not start the next one until the previous gate passes (see `ROADMAP.md`).
3. Every change ships with tests, an updated `CONTEXT.md` if new terms appear, and a PR section listing what was NOT verified.

## Quickstart

Needs Node >= 24 (corepack), uv, Docker (for RLS tests), Supabase CLI.

```bash
make dev        # installs JS + Python deps and git hooks, then runs web (:3000) + API (:8000)
make check      # lint, typecheck, unit + contract tests (JS and Python)
make e2e        # Playwright smoke (starts both servers itself)
make rls        # local Supabase + pgTAP RLS tests
```

Blueprint: `docs/specs/`, `docs/adr/`, `docs/architecture/domain-model.md`, `docs/design/`, `docs/security/`, `docs/tickets/`. Agent boundaries: `docs/runbooks/agent-harness.md`.

## Confidentiality

Proprietary. Never commit real client data, API keys or credentials. See `.env.example` for variable names only.
