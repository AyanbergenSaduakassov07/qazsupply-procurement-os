"""OpenSanctions sample connector (SYNTHETIC, invented entities). Real screening data needs a
commercial licence (bulk data is CC BY-NC 4.0; licence model VERIFIED 2026-10-12, price is a quote).
Trigger to replace: licence signed -> hosted API or yente sidecar
(docs/research/oss-verification-M4.md)."""

import json
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

from connectors._contract.contract import SourceRecord, raw_digest
from connectors.outage import require

FIXTURE = Path(__file__).parent / "fixtures" / "entities.json"
REQUIRED = ("id", "schema", "names", "birth_year", "countries", "topics", "program")


class SampleSanctions:
    source_id = "opensanctions"
    licence = "synthetic sample (no third-party data)"
    is_sample = True

    def __init__(self, fixture: Path = FIXTURE) -> None:
        data = json.loads(fixture.read_text(encoding="utf-8"))
        self.version: str = data["version"]
        self._raw = data["entities"]

    def fetch(self, since: datetime | None = None) -> Iterable[SourceRecord]:
        fetched = datetime.now(UTC)
        return [
            SourceRecord(
                source_id=self.source_id,
                fetched_at=fetched,
                licence=self.licence,
                payload=require(self.source_id, e, REQUIRED),
                raw_sha256=raw_digest(json.dumps(e, ensure_ascii=False, sort_keys=True)),
            )
            for e in self._raw
        ]
