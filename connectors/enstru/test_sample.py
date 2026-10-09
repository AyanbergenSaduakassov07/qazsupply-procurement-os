import pytest

from connectors._contract.contract import check_records
from connectors.enstru.sample import SampleEnstru

pytestmark = pytest.mark.contract


def test_sample_connector_meets_the_contract() -> None:
    connector = SampleEnstru()
    records = list(connector.fetch())
    assert len(records) >= 30
    assert check_records(connector, records) == []


def test_sample_codes_can_never_pass_as_real_codes() -> None:
    codes = [r.payload["code"] for r in SampleEnstru().fetch()]
    assert all(str(c).startswith("SYN-") for c in codes)
    assert len(set(codes)) == len(codes)
