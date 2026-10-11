# Architecture decision records

Template: `0000-template.md`. Append-only: supersede, never rewrite.

- [0001](0001-modular-monolith.md) Modular monolith with deep modules (proposed)
- [0002](0002-postgres-rls-tenancy.md) Postgres + RLS tenancy model (proposed; baseline implemented)
- [0003](0003-event-sourced-logistics.md) Event-sourced logistics and conflict resolution (proposed)
- [0004](0004-llm-gateway.md) LLM gateway and "LLM never computes numbers" (proposed)
- [0005](0005-connector-contract.md) Connector contract (proposed; implemented)
- [0006](0006-reference-tables.md) Global reference tables without org_id (accepted)
- [0007](0007-m2-matching-stack.md) M2 matching and analysis stack: lexical first, models on evidence (accepted)
- [0008](0008-m3-review-gate-and-ask-boundary.md) M3 review gate in the database, review console in apps/web, Ask data boundary (accepted)
