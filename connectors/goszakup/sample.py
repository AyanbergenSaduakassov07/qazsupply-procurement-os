"""goszakup sample connector (SYNTHETIC): the unreliable-supplier registry (РНУ). Real access:
OWS v3 with a token from АО «ЦЭФ» (docs/compliance/data-sources.md, PARTIAL)."""

import json
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from connectors._contract.contract import SourceRecord, raw_digest
from connectors.outage import require

FIXTURE = Path(__file__).parent / "fixtures" / "rnu.json"
REQUIRED = ("bin", "name", "included_on", "until", "reason_ru", "reason_kk", "reason_en")


class SampleGoszakup:
    source_id = "goszakup"
    licence = "synthetic sample (no third-party data)"
    is_sample = True

    def __init__(self, fixture: Path = FIXTURE) -> None:
        data = json.loads(fixture.read_text(encoding="utf-8"))
        self.version: str = data["version"]
        self._entries = data["entries"]

    def _record(self, raw: dict[str, Any]) -> SourceRecord:
        return SourceRecord(
            source_id=self.source_id,
            fetched_at=datetime.now(UTC),
            licence=self.licence,
            payload=require(self.source_id, raw, REQUIRED),
            raw_sha256=raw_digest(json.dumps(raw, ensure_ascii=False, sort_keys=True)),
        )

    def unreliable(self, bin_: str) -> SourceRecord | None:
        """The РНУ entry for a BIN, None if the supplier is not listed."""
        return next((self._record(e) for e in self._entries if e.get("bin") == bin_), None)

    def fetch(self, since: datetime | None = None) -> Iterable[SourceRecord]:
        return [self._record(e) for e in self._entries]
