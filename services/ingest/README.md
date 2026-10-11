# services/ingest

Purchase-history files in, validated Purchase Lines out.

**Public interface** (`services.ingest.api`):
- `preview(data, filename, sheet=None) -> Preview`: parse, detect the header row, suggest a column mapping (ru/kk/en synonyms + value sniffing), 20 sample rows, error counts. Stores nothing.
- `ingest(conn, org_id, data, filename, mapping, sheet=None, header_row=None) -> IngestResult`: validate every row, insert valid lines with source row and raw cells, report the rest with error codes. Idempotent by file sha256 per org.
- `list_uploads(conn, org_id)`, `FileRejected(code)`, `MAX_BYTES`, `normalise_unit`.

**Rules:** invalid rows never block valid ones; raw values are immutable (column grants); cell text is untrusted (stored, never evaluated); macro, `.xls/.xlsm`, corrupt and oversized files are rejected with a code the UI translates (`ingest.error.*`). Fixtures: `fixtures/` (synthetic, rebuild with `uv run python -m services.ingest.fixtures.build`).
