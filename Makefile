# One command from a fresh clone: `make dev` (installs, starts local Supabase, runs web + API).
.PHONY: install db dev check test e2e visual lighthouse rls advisors

SUPABASE := supabase --workdir infra
SKIP := studio,imgproxy,inbucket,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta
PUBLISHABLE_KEY = $$($(SUPABASE) status -o json | python3 -c 'import sys,json;print(json.load(sys.stdin)["PUBLISHABLE_KEY"])')

install:
	corepack enable pnpm
	pnpm install --frozen-lockfile
	uv sync
	uv run pre-commit install --hook-type pre-commit --hook-type commit-msg

db:
	$(SUPABASE) status >/dev/null 2>&1 || $(SUPABASE) start -x $(SKIP)

dev: install db
	SUPABASE_PUBLISHABLE_KEY=$(PUBLISHABLE_KEY) pnpm dev

check:
	pnpm lint && pnpm typecheck && pnpm test
	uv run ruff check . && uv run ruff format --check . && uv run mypy
	uv run pytest -m "not contract and not integration" && uv run pytest -m contract

rls: db
	$(SUPABASE) test db
	bash scripts/advisors.sh
	uv run pytest -m integration

advisors: db
	bash scripts/advisors.sh

e2e: db
	SUPABASE_PUBLISHABLE_KEY=$(PUBLISHABLE_KEY) pnpm e2e

# Visual baselines and Lighthouse need the production web build running on :3000 and the API on :8000.
visual:
	bash scripts/e2e-visual.sh

lighthouse:
	bash scripts/lighthouse-a11y.sh
