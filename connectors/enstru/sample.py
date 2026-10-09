"""ЕНС ТРУ sample connector (SYNTHETIC). Real access path: goszakup OWS `Lots.enstruList`
(docs/compliance/data-sources.md). Domain code sees only SourceRecords (ADR 0005)."""

import json
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

from connectors._contract.contract import SourceRecord, raw_digest

FIXTURE = Path(__file__).parent / "fixtures" / "sample_codes.json"


class SampleEnstru:
    source_id = "enstru"
    licence = "synthetic sample (no third-party data)"
    is_sample = True

    def fetch(self, since: datetime | None = None) -> Iterable[SourceRecord]:
        raw = FIXTURE.read_text(encoding="utf-8")
        fetched = datetime.now(UTC)
        for code in json.loads(raw)["codes"]:
            yield SourceRecord(
                source_id=self.source_id,
                fetched_at=fetched,
                licence=self.licence,
                payload=code,
                raw_sha256=raw_digest(json.dumps(code, ensure_ascii=False, sort_keys=True)),
            )
