# 0003. Event-sourced logistics and conflict resolution

- Status: proposed
- Date: 2026-10-08
- Deciders: Ayan, Claude

## Context
Shipment status arrives from many unreliable sources (carrier APIs, AIS, rail, emails, PDFs, manual entry), often late, duplicated or contradictory. Coordinators must see *why* we believe a shipment is somewhere, and we must be able to fix a bad source and recompute.

## Decision
`shipment_events` is append-only (no UPDATE/DELETE grants; trigger rejects them). Each event: `org_id, shipment_id, type, occurred_at, recorded_at, source, source_event_id, confidence, raw_sha256`. Idempotency key `(source, source_event_id)`. Current state is a pure fold over events ordered by `(occurred_at, source_priority, recorded_at, id)`. Conflict rule (deterministic): (1) manual human entry beats everything; (2) document-backed events (CMR/SMGS stamp, customs release) beat telemetry; (3) carrier API beats AIS/derived; (4) within the same rank, higher confidence wins, then later `recorded_at`. Events that would cause an illegal transition are kept but marked ignored, with the reason. Projection tables are caches, rebuildable by replay. Property test: replaying any permutation of the same event set that respects the ordering key yields identical state, and replaying twice is identical.

## Alternatives considered
- Mutable shipment row with last-write-wins: loses provenance; out-of-order events corrupt state.
- Full event store product (EventStoreDB, Kafka): extra infra before any scale need; Postgres append-only table is enough at 50-5,000 live shipments.

## Consequences
- Easier: audit, "why do we think it is here", re-scoring a source after we learn it is unreliable.
- Harder: projections must be rebuilt on rule changes; rule changes are versioned and recorded in this ADR's successors.
- Monitor: projection rebuild time; source reliability per carrier.
