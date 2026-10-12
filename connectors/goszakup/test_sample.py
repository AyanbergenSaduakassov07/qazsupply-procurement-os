import pytest

from connectors._contract.contract import check_records
from connectors.goszakup.sample import SampleGoszakup

pytestmark = pytest.mark.contract


def test_sample_goszakup_meets_the_contract() -> None:
    connector = SampleGoszakup()
    assert check_records(connector, list(connector.fetch())) == []


def test_unreliable_lookup() -> None:
    listed = SampleGoszakup().unreliable("210987654321")
    assert listed is not None and listed.payload["until"] == "2027-11-03"
    assert SampleGoszakup().unreliable("123456789012") is None
