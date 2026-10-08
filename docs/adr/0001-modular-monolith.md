# 0001. Modular monolith with deep modules

- Status: proposed
- Date: 2026-10-08
- Deciders: Ayan (owner), Claude (proposal)

## Context
One to two builders (Q3), 14 capabilities over 5 years, strong consistency needs (Evidence must reproduce figures exactly), and a tenancy model that relies on one Postgres with RLS. Microservices would multiply deploys, auth surfaces and distributed-transaction problems before any of them pays off.

## Decision
One Python deployable (`services/gateway` composes all `services/*` modules) plus Python workers from the same codebase, and Next.js apps. Each `services/<context>` is a deep module: a narrow public interface (documented in its README), hidden internals, no imports of another module's internals, no reads of another module's tables. A single `pyproject.toml` at the root; `services` is the import root (`services.ingest`, ...).

## Alternatives considered
- Microservices per context: operational cost too high for team size; no measured boundary pain.
- Serverless functions: cold starts for Excel parsing and OCR; harder local replay of event streams.
- Separate uv workspace member per module: deferred until a module needs dependencies that conflict with others.

## Consequences
- Easier: refactors across modules, one CI, one transaction boundary when needed.
- Harder: discipline; an import-linter rule (M1) must enforce "no internal imports across modules".
- Monitor: extract a service only when a boundary hurts (independent scaling for OCR/forecasting workers, or a different security zone for finance in M8).
