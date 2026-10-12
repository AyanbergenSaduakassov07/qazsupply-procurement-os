import pytest

from connectors._contract.contract import check_records
from connectors.opensanctions.sample import SampleSanctions

pytestmark = pytest.mark.contract


def test_sample_sanctions_meets_the_contract() -> None:
    connector = SampleSanctions()
    records = list(connector.fetch())
    assert check_records(connector, records) == []
    ids = [r.payload["id"] for r in records]
    assert all(str(i).startswith("SAMPLE-") for i in ids)  # invented, never passes as real
    assert len(set(ids)) == len(ids)
