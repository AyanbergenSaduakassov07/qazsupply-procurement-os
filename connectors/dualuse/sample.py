"""Dual-use goods sample connector (SYNTHETIC keyword list, NOT a legal control list). The real
lists (EAEU / Kazakhstan export control list, EU Regulation 2021/821 Annex I) need a primary-source
review and HS/ЕНС ТРУ mapping before any production use (docs/compliance/data-sources.md)."""

import json
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

from connectors._contract.contract import SourceRecord, raw_digest
from connectors.outage import require

FIXTURE = Path(__file__).parent / "fixtures" / "controls.json"
REQUIRED = ("id", "label_en", "label_ru", "label_kk", "keywords")


class SampleDualUse:
    source_id = "dualuse"
    licence = "synthetic sample (no third-party data)"
    is_sample = True

    def __init__(self, fixture: Path = FIXTURE) -> None:
        data = json.loads(fixture.read_text(encoding="utf-8"))
        self.version: str = data["version"]
        self._raw = data["controls"]

    def fetch(self, since: datetime | None = None) -> Iterable[SourceRecord]:
        fetched = datetime.now(UTC)
        return [
            SourceRecord(
                source_id=self.source_id,
                fetched_at=fetched,
                licence=self.licence,
                payload=require(self.source_id, c, REQUIRED),
                raw_sha256=raw_digest(json.dumps(c, ensure_ascii=False, sort_keys=True)),
            )
            for c in self._raw
        ]
