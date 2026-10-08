# 0005. Connector contract

- Status: proposed (implemented: `connectors/_contract/contract.py` + tests)
- Date: 2026-10-08
- Deciders: Ayan, Claude

## Context
We depend on government portals, sanctions data, carriers and news, each with different access, licences and failure modes. External data must never reach domain code raw, and we must prove where every cached fact came from.

## Decision
Every source is an adapter in `connectors/<id>/` implementing `Connector` (`source_id`, `licence`, `fetch(since) -> Iterable[SourceRecord]`). A `SourceRecord` carries `source_id, fetched_at (tz-aware), licence, payload (JSON), raw_sha256`. Raw payloads are stored by hash (object storage) for replay. `check_records()` is the contract test every adapter runs against its fixtures. A source must be in `docs/compliance/data-sources.md` (id = folder name) before code exists; CI fails otherwise. Each adapter documents and tests three degraded states: source down, rate-limited, schema drift. Credentials are per tenant where the source is the client's own (carriers, ИС ЭСФ), encrypted, never logged. UNVERIFIED sources get a mock adapter and a visible "sample data" badge.

## Alternatives considered
- Integration platform (Airbyte, n8n): heavy for sources that mostly lack standard connectors; licence terms vary; we need provenance per record.
- Ad-hoc HTTP clients in domain modules: the failure we are designing against.

## Consequences
- Adding a source = register row + adapter + fixtures + contract test.
- Mapping from SourceRecord to domain objects lives in the consuming module (anti-corruption layer).
- Monitor: per-source freshness, error rate, schema-drift alerts.
