from datetime import date
from decimal import Decimal

import pytest

from connectors._contract.contract import check_records
from connectors.fx.nbk import NbkFx, parse_rates

pytestmark = pytest.mark.contract


def test_real_snapshot_parses() -> None:
    fx = NbkFx()
    rate, used = fx.rate("USD", date(2026, 3, 14))
    assert rate == Decimal("491.29") and used == date(2026, 3, 14)


def test_nearest_earlier_published_rate_is_used_and_reported() -> None:
    rate, used = NbkFx().rate("USD", date(2026, 3, 16))
    assert used == date(2026, 3, 14) and rate > 0


def test_kzt_is_identity() -> None:
    assert NbkFx().rate("KZT", date(2020, 1, 1)) == (Decimal(1), date(2020, 1, 1))


def test_missing_rate_is_an_error_not_a_guess() -> None:
    with pytest.raises(LookupError):
        NbkFx().rate("USD", date(2020, 1, 1))


def test_hostile_xml_is_refused() -> None:
    with pytest.raises(ValueError):
        parse_rates(b'<!DOCTYPE x [<!ENTITY a "b">]><rates/>')


def test_fx_connector_meets_the_contract() -> None:
    fx = NbkFx()
    records = list(fx.fetch())
    assert records and check_records(fx, records) == []
