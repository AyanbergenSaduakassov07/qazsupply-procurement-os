from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

import pytest

from connectors._contract.contract import (
    SourceRecord,
    check_records,
    raw_digest,
    registered_source_ids,
)

pytestmark = pytest.mark.contract
CONNECTORS = Path(__file__).resolve().parents[1]


class FakeConnector:
    source_id = "fx"
    licence = "test"

    def fetch(self, since: datetime | None) -> Iterable[SourceRecord]:
        return []


def _record(**overrides: object) -> SourceRecord:
    fields: dict[str, object] = {
        "source_id": "fx",
        "fetched_at": datetime(2026, 10, 8, tzinfo=UTC),
        "licence": "test",
        "payload": {"USD": "1"},
        "raw_sha256": raw_digest("<rss/>"),
    }
    fields.update(overrides)
    return SourceRecord(**fields)  # type: ignore[arg-type]


def test_valid_record_passes() -> None:
    assert check_records(FakeConnector(), [_record()]) == []


@pytest.mark.parametrize(
    ("override", "fragment"),
    [
        ({"fetched_at": datetime(2026, 10, 8)}, "timezone-aware"),
        ({"licence": ""}, "licence missing"),
        ({"raw_sha256": "nope"}, "sha256"),
        ({"source_id": "other"}, "source_id"),
        ({"payload": {"x": object()}}, "JSON"),
    ],
)
def test_violations_are_reported(override: dict[str, object], fragment: str) -> None:
    errors = check_records(FakeConnector(), [_record(**override)])
    assert any(fragment in e for e in errors), errors


def test_every_connector_folder_is_in_the_source_register() -> None:
    folders = {p.name for p in CONNECTORS.iterdir() if p.is_dir() and not p.name.startswith("_")}
    folders -= {"__pycache__"}
    missing = folders - registered_source_ids()
    assert not missing, f"add these to docs/compliance/data-sources.md first: {sorted(missing)}"
