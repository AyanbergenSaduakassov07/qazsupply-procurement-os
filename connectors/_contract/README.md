# connectors/_contract

Shared connector interface and contract test kit (ADR 0005).

**Public interface** (`connectors._contract.contract`):
- `SourceRecord(source_id, fetched_at, licence, payload, raw_sha256)`: the only shape external data takes inside the system.
- `Connector` protocol: `source_id`, `licence`, `fetch(since) -> Iterable[SourceRecord]`.
- `raw_digest(raw)`: sha256 of the raw payload.
- `check_records(connector, records) -> list[str]`: contract violations; empty list = pass. Every adapter's contract test calls it on its fixtures.
- `registered_source_ids()`: ids from `docs/compliance/data-sources.md`. CI fails if a `connectors/<id>/` folder is missing from the register.

**Rules:** register the source first; fixtures only (no live calls in tests); test source-down, rate-limited and schema-drift states.
