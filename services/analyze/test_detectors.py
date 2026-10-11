"""Detector properties. Savings must reconcile to the source lines they cite."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st

from services.analyze.config import AnalysisConfig
from services.analyze.detectors import CENT, Line, outliers, price_variance, run_all

CFG = AnalysisConfig()
ITEM = uuid.uuid4()
SUPPLIERS = [uuid.uuid4() for _ in range(4)]


def line(supplier: int, price: int, qty: int = 1, day: int = 0, item: uuid.UUID = ITEM) -> Line:
    return Line(
        uuid.uuid4(),
        item,
        SUPPLIERS[supplier],
        Decimal(qty),
        "pcs",
        Decimal(price),
        date(2026, 3, 1) + timedelta(days=day),
    )


lines_strategy = st.lists(
    st.tuples(st.integers(0, 3), st.integers(1, 100_000), st.integers(1, 50), st.integers(0, 200)),
    min_size=0,
    max_size=40,
).map(lambda rows: [line(s, p, q, d) for s, p, q, d in rows])


def test_overpriced_supplier_is_found_with_reconciling_saving() -> None:
    ls = [line(0, 120, 10), line(0, 130, 10), line(1, 100, 5), line(1, 100, 5), line(2, 102, 5)]
    (f,) = price_variance(ls, CFG)
    assert f.supplier_id == SUPPLIERS[0] and f.details["reference_median_kzt"] == "100.00"
    assert f.saving_kzt == Decimal("500.00")  # (120-100)*10 + (130-100)*10


def test_equal_prices_produce_no_findings() -> None:
    ls = [line(s, 500, 3, d) for s in range(3) for d in range(0, 300, 100)]
    assert [f for f in run_all(ls, CFG) if f.saving_kzt > 0] == []


@settings(max_examples=200, deadline=None)
@given(lines_strategy)
def test_savings_are_never_negative(ls: list[Line]) -> None:
    assert all(f.saving_kzt >= 0 for f in run_all(ls, CFG))


@settings(max_examples=200, deadline=None)
@given(lines_strategy, st.integers(2, 9))
def test_price_scaling_scales_savings_exactly(ls: list[Line], k: int) -> None:
    scaled = [
        Line(
            ln.id,
            ln.item_id,
            ln.supplier_id,
            ln.quantity,
            ln.unit,
            ln.price_kzt * k,
            ln.purchased_on,
        )
        for ln in ls
    ]
    base = {
        (f.type, f.supplier_id, f.line_ids): f.saving_kzt
        for f in price_variance(ls, CFG) + outliers(ls, CFG)
    }
    big = {
        (f.type, f.supplier_id, f.line_ids): f.saving_kzt
        for f in price_variance(scaled, CFG) + outliers(scaled, CFG)
    }
    assert base.keys() == big.keys()
    for key, saving in base.items():
        assert abs(big[key] - saving * k) <= CENT * k  # cent rounding only


@settings(max_examples=200, deadline=None)
@given(lines_strategy)
def test_price_variance_saving_recomputes_from_its_evidence_lines(ls: list[Line]) -> None:
    by_id = {ln.id: ln for ln in ls}
    for f in price_variance(ls, CFG):
        ref = Decimal(f.details["reference_median_kzt"])
        own = [by_id[i] for i in f.line_ids if by_id[i].supplier_id == f.supplier_id]
        recomputed = sum(
            ((ln.price_kzt - ref) * ln.quantity for ln in own if ln.price_kzt > ref), Decimal(0)
        )
        assert abs(recomputed - f.saving_kzt) <= CENT * max(
            len(own), 1
        )  # reference shown rounded to cents


def test_outlier_needs_enough_history() -> None:
    ls = [line(0, 100), line(0, 100), line(1, 100), line(1, 5000)]
    assert outliers(ls, CFG) == []
    ls += [line(2, 100), line(2, 101)]
    (f,) = outliers(ls, CFG)
    assert f.line_ids == (ls[3].id,)


def test_prices_in_different_units_are_never_compared() -> None:
    ls = [line(0, 100), line(0, 100), line(1, 100), line(1, 100)]
    ls += [
        Line(
            uuid.uuid4(), ITEM, SUPPLIERS[2], Decimal(1), "pack", Decimal(10_000), date(2026, 3, 1)
        )
        for _ in range(2)
    ]
    assert price_variance(ls, CFG) == []


def test_org_overrides_are_validated_and_typed() -> None:
    cfg = AnalysisConfig.for_org(
        {"price_variance_min_pct": "0.2", "repeat_min_orders": "6", "nope": 1}
    )
    assert cfg.price_variance_min_pct == Decimal("0.2") and cfg.repeat_min_orders == 6
