import pytest

from connectors._contract.contract import check_records
from connectors.dualuse.sample import SampleDualUse

pytestmark = pytest.mark.contract


def test_sample_dualuse_meets_the_contract() -> None:
    connector = SampleDualUse()
    records = list(connector.fetch())
    assert check_records(connector, records) == []
    assert all(str(r.payload["id"]).startswith("SAMPLE-") for r in records)
