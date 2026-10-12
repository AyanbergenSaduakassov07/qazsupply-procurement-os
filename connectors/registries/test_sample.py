import json

import pytest

from connectors._contract.contract import check_records
from connectors.outage import SourceUnavailable
from connectors.registries.fixtures.build import OUT, build
from connectors.registries.sample import SampleRegistry

pytestmark = pytest.mark.contract


def test_sample_registry_meets_the_contract() -> None:
    connector = SampleRegistry()
    records = list(connector.fetch())
    assert len(records) >= 8
    assert check_records(connector, records) == []


def test_fixture_is_the_committed_build_output() -> None:
    assert json.loads(OUT.read_text(encoding="utf-8")) == json.loads(json.dumps(build()))


def test_lookup_by_bin_and_unknown_bin() -> None:
    r = SampleRegistry().company("123456789012")
    assert r is not None and r.payload["name"] == "ТОО «Альфа»"
    assert SampleRegistry().company("000000000001") is None


@pytest.mark.parametrize(
    ("bin_", "reason"),
    [("990000000001", "down"), ("990000000002", "rate_limited"), ("990000000003", "schema_drift")],
)
def test_each_failure_mode_is_typed(bin_: str, reason: str) -> None:
    with pytest.raises(SourceUnavailable) as e:
        SampleRegistry().company(bin_)
    assert e.value.reason == reason and e.value.source_id == "registries"


def test_persons_carry_only_minimised_fields() -> None:
    allowed = {"ref", "kind", "name", "country", "birth_year", "role", "share_pct"}
    for r in SampleRegistry().fetch():
        for o in r.payload["owners"]:
            if o["kind"] == "person":
                assert set(o) <= allowed, o
