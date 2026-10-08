"""Connector contract (ADR 0005). Every external source is an adapter that yields SourceRecords.

Domain code only ever sees SourceRecords, never raw responses.
"""

import hashlib
import json
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

REGISTER = Path(__file__).resolve().parents[2] / "docs" / "compliance" / "data-sources.md"


@dataclass(frozen=True)
class SourceRecord:
    source_id: str
    fetched_at: datetime
    licence: str
    payload: Mapping[str, Any]
    raw_sha256: str


class Connector(Protocol):
    source_id: str
    licence: str

    def fetch(self, since: datetime | None) -> Iterable[SourceRecord]: ...


def raw_digest(raw: bytes | str) -> str:
    data = raw.encode() if isinstance(raw, str) else raw
    return hashlib.sha256(data).hexdigest()


def registered_source_ids(register: Path = REGISTER) -> set[str]:
    """Source ids from the `id` column of the data-sources register."""
    ids = set()
    for line in register.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\|\s*`([a-z0-9_-]+)`\s*\|", line)
        if match:
            ids.add(match.group(1))
    return ids


def check_records(connector: Connector, records: Iterable[SourceRecord]) -> list[str]:
    """Return contract violations (empty list = pass). Used by each connector's contract test."""
    errors = []
    if connector.source_id not in registered_source_ids():
        errors.append(f"{connector.source_id}: not in docs/compliance/data-sources.md")
    for i, rec in enumerate(records):
        where = f"{connector.source_id}[{i}]"
        if rec.source_id != connector.source_id:
            errors.append(f"{where}: source_id {rec.source_id!r} != {connector.source_id!r}")
        if rec.fetched_at.tzinfo is None:
            errors.append(f"{where}: fetched_at must be timezone-aware")
        if not rec.licence:
            errors.append(f"{where}: licence missing")
        if not re.fullmatch(r"[0-9a-f]{64}", rec.raw_sha256):
            errors.append(f"{where}: raw_sha256 is not a sha256 hex digest")
        try:
            json.dumps(rec.payload)
        except TypeError as e:
            errors.append(f"{where}: payload not JSON-serialisable ({e})")
    return errors
