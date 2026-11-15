# 0006. Global reference tables without org_id

- Status: accepted
- Date: 2026-10-08
- Deciders: Ayanbergen Saduakassov (review pending)

## Context
docs/design/design-system.md rule 4 says every table has `org_id` and RLS. Some data is public and shared by every
tenant: border crossings now, the ЕНС ТРУ classifier and FX rates later. Copying it per tenant
wastes storage and lets copies drift.

## Decision
Public reference data lives in tables without `org_id`, with RLS enabled, a `select ... using (true)`
policy for `authenticated`, no write grants for users (written by the service role from a connector
with source + licence recorded), and no grants for `anon`. The pgTAP suite asserts the exact list of
tables without `org_id` (`border_nodes`, plus `organizations`, which is the tenant root), so adding
another one fails CI until this ADR's list is updated.

## Alternatives considered
- Per-tenant copies: drift and storage cost, no isolation benefit for public data.
- A separate schema not exposed to PostgREST: workable; revisit if reference data grows large.

## Consequences
Reference rows must never hold client data. Classification "Public" only (`docs/compliance/data-classification.md`).
