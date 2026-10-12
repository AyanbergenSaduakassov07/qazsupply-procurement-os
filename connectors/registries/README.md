# connectors/registries (SAMPLE)

Invented company registry: companies by BIN with owners, beneficial owners and directors (persons minimised to name, country, birth year). `SampleRegistry().company(bin)` returns a `SourceRecord` or `None`; failures raise `connectors.outage.SourceUnavailable` (`down`, `rate_limited`, `schema_drift`; BINs `990000000001..3` simulate them). Rebuild the fixture: `uv run python -m connectors.registries.fixtures.build`. Real registries need an access agreement (`docs/compliance/data-sources.md`).
