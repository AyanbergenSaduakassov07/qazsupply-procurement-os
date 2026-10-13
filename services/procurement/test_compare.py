from datetime import date
from decimal import Decimal
from typing import Any

from hypothesis import given
from hypothesis import strategies as st

from services.procurement.compare import compare, weights_for

ITEMS = [{"name": "Цемент М400", "quantity": 40, "unit": "т"}]
USD = (Decimal("475.5"), date(2026, 10, 12))


def offer(oid: str, price: float | None, lead: int, pay: int, risk: int = 10, cur: str = "KZT",
          confirmed: bool = True) -> dict[str, Any]:  # fmt: skip
    lines = [] if price is None else [{"item": 0, "unit_price": price}]
    return {"id": oid, "supplier": oid, "confirmed": confirmed, "currency": cur, "lines": lines,
            "lead_time_days": lead, "payment_days": pay, "risk_score": risk}  # fmt: skip


def rate(cur: str) -> tuple[Decimal, date] | None:
    return USD if cur == "USD" else None


def test_cheapest_wins_by_default_and_lead_time_can_flip_it() -> None:
    weights = {"price": 0.35, "lead_time": 0.3, "payment": 0.1, "risk": 0.25}
    c = compare(ITEMS, [offer("a", 31000, 30, 30), offer("b", 31500, 5, 30)], weights, rate)
    assert c.winner == "a"
    flip = [s for s in c.sensitivity if s["criterion"] == "lead_time" and s["factor"] == "2"]
    assert flip[0]["changes"] and flip[0]["winner"] == "b"


def test_missing_price_unconfirmed_and_unknown_currency_are_listed_not_ranked() -> None:
    c = compare(ITEMS, [offer("a", 31000, 10, 30), offer("b", None, 10, 30),
                        offer("c", 60, 10, 30, cur="EUR"), offer("d", 1, 10, 30, confirmed=False)],
                None, rate)  # fmt: skip
    reasons = {r.offer_id: r.excluded for r in c.rows}
    assert reasons == {"a": None, "b": "missing_price", "c": "no_fx_rate", "d": "not_confirmed"}
    assert c.winner == "a"


def test_currency_mix_is_compared_in_kzt_with_the_rate_date() -> None:
    c = compare(
        ITEMS, [offer("kzt", 31000, 10, 30), offer("usd", 60, 10, 30, cur="USD")], None, rate
    )
    usd = next(r for r in c.rows if r.offer_id == "usd")
    assert usd.total_kzt == Decimal("1141200.00") and usd.rate_date == date(2026, 10, 12)
    assert c.winner == "usd"  # 40 x 60 x 475.5 = 1 141 200 < 1 240 000


def test_weights_are_normalised_and_negative_weights_clamped() -> None:
    w = weights_for({"price": 2, "lead_time": -1})
    assert sum(w.values()) == 1 and w["lead_time"] == 0


@given(st.lists(st.integers(1, 10_000), min_size=2, max_size=6), st.integers(1, 9))
def test_scaling_all_prices_never_changes_the_winner(prices: list[int], k: int) -> None:
    base = [offer(str(i), p, 10, 30) for i, p in enumerate(prices)]
    scaled = [offer(str(i), p * k, 10, 30) for i, p in enumerate(prices)]
    assert compare(ITEMS, base, None, rate).winner == compare(ITEMS, scaled, None, rate).winner
