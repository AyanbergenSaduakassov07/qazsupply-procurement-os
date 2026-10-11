# One command from a fresh clone: `make dev` (installs, starts local Supabase, runs web + API).
.PHONY: help install db dev check e2e visual lighthouse rls advisors

SUPABASE := supabase --workdir infra
SKIP := studio,imgproxy,inbucket,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta
PUBLISHABLE_KEY = $$($(SUPABASE) status -o json | python3 -c 'import sys,json;print(json.load(sys.stdin)["PUBLISHABLE_KEY"])')

help:  ## List targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-11s %s\n", $$1, $$2}'

install:  ## Install JS + Python deps and git hooks
	corepack enable pnpm
	pnpm install --frozen-lockfile
	uv sync
	uv run pre-commit install --hook-type pre-commit --hook-type commit-msg

db:  ## Start local Supabase if it is not running
	$(SUPABASE) status >/dev/null 2>&1 || $(SUPABASE) start -x $(SKIP)

dev: install db  ## Run web :3000 + API :8000 against local Supabase
	SUPABASE_PUBLISHABLE_KEY=$(PUBLISHABLE_KEY) pnpm dev

check:  ## Lint, typecheck, unit + contract tests
	pnpm lint && pnpm typecheck && pnpm test
	uv run ruff check . && uv run ruff format --check . && uv run mypy
	uv run pytest -m "not contract and not integration" && uv run pytest -m contract

# Resets the LOCAL database first so pgTAP sees exactly the seed (audit rows are append-only).
rls: db  ## Reset local DB; pgTAP, advisors, API integration tests
	$(SUPABASE) db reset
	@for i in $$(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:54321/auth/v1/health && break; sleep 1; done
	$(SUPABASE) test db
	bash scripts/advisors.sh
	uv run pytest -m integration

advisors: db  ## Supabase advisor lints on the local DB
	bash scripts/advisors.sh

e2e: db  ## Playwright functional suites (3 viewports)
	SUPABASE_PUBLISHABLE_KEY=$(PUBLISHABLE_KEY) pnpm e2e

# Visual baselines and Lighthouse need the production web build running on :3000 and the API on :8000.
visual:  ## Visual baselines in the Linux Playwright image
	bash scripts/e2e-visual.sh

lighthouse:  ## Lighthouse accessibility gate (>= 95)
	bash scripts/lighthouse-a11y.sh
