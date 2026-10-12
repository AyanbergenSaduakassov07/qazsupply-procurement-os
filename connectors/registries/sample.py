"""Company registry sample connector (SYNTHETIC). Real registries (stat.gov.kz, egov.kz) need an
official access agreement: no open API, no scraping behind logins (docs/compliance/data-sources.md).
Domain code sees only SourceRecords and SourceUnavailable (ADR 0005)."""

import json
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from connectors._contract.contract import SourceRecord, raw_digest
from connectors.outage import SourceUnavailable, require

FIXTURE = Path(__file__).parent / "fixtures" / "companies.json"
REQUIRED = ("bin", "name", "status", "registered_on", "country", "owners")


class SampleRegistry:
    source_id = "registries"
    licence = "synthetic sample (no third-party data)"
    is_sample = True

    def __init__(self, fixture: Path = FIXTURE) -> None:
        data = json.loads(fixture.read_text(encoding="utf-8"))
        self.version: str = data["version"]
        self._by_bin = {c["bin"]: c for c in data["companies"]}

    def _record(self, raw: dict[str, Any]) -> SourceRecord:
        simulate = raw.get("simulate")
        if simulate in ("down", "rate_limited"):
            raise SourceUnavailable(
                self.source_id, simulate, 60 if simulate == "rate_limited" else None
            )
        payload = require(self.source_id, raw, REQUIRED)
        return SourceRecord(
            source_id=self.source_id,
            fetched_at=datetime.now(UTC),
            licence=self.licence,
            payload=payload,
            raw_sha256=raw_digest(json.dumps(raw, ensure_ascii=False, sort_keys=True)),
        )

    def company(self, bin_: str) -> SourceRecord | None:
        """The registry entry for a BIN, None if the registry has no such company."""
        raw = self._by_bin.get(bin_)
        return None if raw is None else self._record(raw)

    def fetch(self, since: datetime | None = None) -> Iterable[SourceRecord]:
        for raw in self._by_bin.values():
            if "simulate" not in raw and all(k in raw for k in REQUIRED):
                yield self._record(raw)
