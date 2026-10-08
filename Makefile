# One command from a fresh clone: `make dev` (installs, then runs web + API).
.PHONY: install dev check test e2e rls

install:
	corepack enable pnpm
	pnpm install --frozen-lockfile
	uv sync
	uv run pre-commit install --hook-type pre-commit --hook-type commit-msg

dev: install
	pnpm dev

check:
	pnpm lint && pnpm typecheck && pnpm test
	uv run ruff check . && uv run ruff format --check . && uv run mypy
	uv run pytest -m "not contract" && uv run pytest -m contract

e2e:
	pnpm e2e

rls:
	supabase start --workdir infra && supabase test db --workdir infra
