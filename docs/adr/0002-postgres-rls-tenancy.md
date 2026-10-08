# 0002. Postgres + RLS tenancy model

- Status: proposed (baseline implemented: `infra/supabase/migrations/20261008000000_tenancy_baseline.sql`)
- Date: 2026-10-08
- Deciders: Ayan, Claude

## Context
Client purchase data is commercially sensitive; a cross-tenant leak ends the business. We need isolation that holds even when application code has a bug, and that we can test.

## Decision
Shared database, shared schema, `org_id` on every client-data table, Row Level Security on every table. Membership-based helper `private.is_member(org_id)` (security definer, in a non-exposed schema, `search_path=''`). Explicit grants per table (Supabase no longer auto-grants new tables). Anonymous role gets nothing on tenant tables. Writes go through the API (service role) until role-aware write policies are added per table. Every policy has a pgTAP test proving cross-tenant read and write fail (`infra/supabase/tests/`), run in CI (`rls` job).

## Alternatives considered
- Schema per tenant: migrations x N, harder analytics across tenants for QazSupply staff, connection pooling pain.
- Database per tenant: strongest isolation, highest cost; revisit for a large enterprise client that requires it (data residency).
- App-level filtering only: one forgotten `WHERE` leaks data; untestable as a property.

## Consequences
- Every new table PR must include RLS + test (PR template checkbox, CI).
- Service-role code paths bypass RLS: the API must set tenancy context and its own tests must prove isolation (M1 Part A.3 "via the API").
- Cross-tenant aggregates (price index, group buys) use separate, consented, k-anonymised tables, never direct cross-tenant queries.
