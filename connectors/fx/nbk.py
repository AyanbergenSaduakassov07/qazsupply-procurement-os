"""National Bank of Kazakhstan official rates (connector id `fx`, register: PARTIAL).

Source of record: https://nationalbank.kz/rss/get_rates.cfm?fdate=DD.MM.YYYY (one XML per day).
Snapshots are cached per date with their sha256; conversions record the rate date actually
used (nearest published date on or before the purchase date) so Evidence can show it.
"""

import json
import urllib.request
import xml.etree.ElementTree as ET  # noqa: S405 - NBK XML is size-capped below; no DTD expansion
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from connectors._contract.contract import SourceRecord, raw_digest

URL = "https://nationalbank.kz/rss/get_rates.cfm?fdate={:%d.%m.%Y}"
FIXTURES = Path(__file__).parent / "fixtures"
MAX_XML_BYTES = 256 * 1024
LOOKBACK_DAYS = 10


def parse_rates(xml: bytes) -> dict[str, Decimal]:
    """KZT per 1 unit of each currency (description / quant)."""
    if len(xml) > MAX_XML_BYTES or b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
        raise ValueError("unexpected NBK payload")
    root = ET.fromstring(xml)  # noqa: S314 - guarded above
    rates = {}
    for item in root.iter("item"):
        code, value, quant = (
            item.findtext("title"),
            item.findtext("description"),
            item.findtext("quant"),
        )
        if code and value and quant:
            rates[code.strip()] = Decimal(value.strip()) / Decimal(quant.strip())
    return rates


class NbkFx:
    source_id = "fx"
    licence = "public official rates; terms not stated (register: PARTIAL)"

    def __init__(self, cache_dir: Path = FIXTURES, allow_network: bool = False) -> None:
        self._cache = cache_dir
        self._network = allow_network

    def _xml(self, day: date) -> bytes | None:
        path = self._cache / f"nbk_{day.isoformat()}.xml"
        if path.exists():
            return path.read_bytes()
        if not self._network:
            return None
        with urllib.request.urlopen(URL.format(day), timeout=10) as resp:  # noqa: S310 - fixed https URL
            data: bytes = resp.read(MAX_XML_BYTES + 1)
        parse_rates(data)  # validate before caching
        path.write_bytes(data)
        return data

    def rate(self, currency: str, on: date) -> tuple[Decimal, date]:
        """(KZT per unit, rate date used). KZT is always 1 on the purchase date."""
        if currency == "KZT":
            return Decimal(1), on
        for back in range(LOOKBACK_DAYS + 1):
            day = on - timedelta(days=back)
            xml = self._xml(day)
            if xml and currency in (rates := parse_rates(xml)):
                return rates[currency], day
        raise LookupError(f"no NBK rate for {currency} within {LOOKBACK_DAYS} days before {on}")

    def fetch(self, since: datetime | None = None) -> Iterable[SourceRecord]:
        """Connector contract: every cached snapshot as SourceRecords (one per currency per day)."""
        fetched = datetime.now(UTC)
        for path in sorted(self._cache.glob("nbk_*.xml")):
            raw = path.read_bytes()
            day = path.stem.removeprefix("nbk_")
            for code, value in parse_rates(raw).items():
                yield SourceRecord(
                    self.source_id,
                    fetched,
                    self.licence,
                    json.loads(json.dumps({"date": day, "currency": code, "kzt": str(value)})),
                    raw_digest(raw),
                )
