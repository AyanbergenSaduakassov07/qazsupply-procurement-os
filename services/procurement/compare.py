"""Offer comparison (pure): normalised matrix, client-weighted score, sensitivity.

Criteria: total price in KZT (lower is better), lead time (lower), payment days (higher), supplier
risk score from Supplier 360 (lower). Landed cost is a placeholder until the M6 logistics model
(`landed_cost` returns None and is shown, not scored). Only confirmed offers are ranked; an offer
missing a price for any item, or in a currency without a rate, is listed with the reason and not
ranked. Scores are min-max normalised per criterion over the ranked offers.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

DEFAULT_WEIGHTS = {"price": Decimal("0.5"), "lead_time": Decimal("0.2"), "payment": Decimal("0.1"),
                   "risk": Decimal("0.2")}  # fmt: skip
LOWER_IS_BETTER = {"price": True, "lead_time": True, "payment": False, "risk": True}
# rate(currency, offer_id) -> (KZT per unit, rate date): each offer converts at its own date.
Rate = Callable[[str, str], tuple[Decimal, date] | None]


@dataclass
class Row:
    offer_id: str
    supplier: str
    confirmed: bool
    currency: str
    total: Decimal | None = None  # in the offer currency
    total_kzt: Decimal | None = None
    rate: Decimal | None = None
    rate_date: date | None = None
    lead_time: int | None = None
    payment: int | None = None
    risk: int | None = None
    landed_cost: Decimal | None = None
    excluded: str | None = None  # reason it is not ranked
    score: Decimal | None = None
    deltas: dict[str, Decimal] = field(default_factory=dict)  # vs the best value, per criterion


@dataclass
class Comparison:
    rows: list[Row]
    weights: dict[str, Decimal]
    winner: str | None
    sensitivity: list[dict[str, Any]]


def weights_for(raw: dict[str, Any] | None) -> dict[str, Decimal]:
    w = {k: Decimal(str(raw[k])) for k in DEFAULT_WEIGHTS if raw and k in raw} if raw else {}
    merged = {k: max(Decimal(0), w.get(k, v)) for k, v in DEFAULT_WEIGHTS.items()}
    total = sum(merged.values())
    return {k: v / total for k, v in merged.items()} if total else dict(DEFAULT_WEIGHTS)


def landed_cost(row: Row) -> Decimal | None:
    """Placeholder for the M6 logistics model (freight, duties, insurance)."""
    return None


def build_rows(items: list[dict[str, Any]], offers: list[dict[str, Any]], rate: Rate) -> list[Row]:
    rows = []
    for o in offers:
        r = Row(str(o["id"]), str(o["supplier"]), bool(o["confirmed"]), o["currency"],
                lead_time=o.get("lead_time_days"), payment=o.get("payment_days"),
                risk=o.get("risk_score"))  # fmt: skip
        prices = {int(line["item"]): Decimal(str(line["unit_price"])) for line in o["lines"]
                  if line.get("unit_price") is not None}  # fmt: skip
        missing = [str(it.get("name")) for i, it in enumerate(items) if i not in prices]
        if missing:
            r.excluded = "missing_price"
        else:
            total = sum(
                (prices[i] * Decimal(str(it["quantity"])) for i, it in enumerate(items)), Decimal(0)
            )
            r.total = total
            fx = (Decimal(1), None) if r.currency == "KZT" else rate(r.currency, r.offer_id)
            if fx is None:
                r.excluded = "no_fx_rate"
            else:
                r.rate, r.rate_date = fx
                r.total_kzt = (total * fx[0]).quantize(Decimal("0.01"))
        if r.excluded is None and not r.confirmed:
            r.excluded = "not_confirmed"
        r.landed_cost = landed_cost(r)
        rows.append(r)
    return rows


def _values(r: Row) -> dict[str, Decimal | None]:
    return {
        "price": r.total_kzt,
        "lead_time": None if r.lead_time is None else Decimal(r.lead_time),
        "payment": None if r.payment is None else Decimal(r.payment),
        "risk": None if r.risk is None else Decimal(r.risk),
    }


def _scores(rows: list[Row], weights: dict[str, Decimal]) -> dict[str, Decimal]:
    ranked = [r for r in rows if r.excluded is None]
    out = {r.offer_id: Decimal(0) for r in ranked}
    for c, w in weights.items():
        vals = {r.offer_id: _values(r)[c] for r in ranked}
        known = [v for v in vals.values() if v is not None]
        if not known or w == 0:
            continue
        lo, hi = min(known), max(known)
        for oid, v in vals.items():
            if v is None:
                continue  # unknown value: no credit on this criterion
            good = (
                Decimal(1)
                if hi == lo
                else ((hi - v) / (hi - lo) if LOWER_IS_BETTER[c] else (v - lo) / (hi - lo))
            )
            out[oid] += w * good
    return out


def _winner(scores: dict[str, Decimal]) -> str | None:
    return min(scores, key=lambda k: (-scores[k], k)) if scores else None


def compare(
    items: list[dict[str, Any]],
    offers: list[dict[str, Any]],
    raw_weights: dict[str, Any] | None,
    rate: Rate,
) -> Comparison:
    weights = weights_for(raw_weights)
    rows = build_rows(items, offers, rate)
    scores = _scores(rows, weights)
    for r in rows:
        r.score = scores.get(r.offer_id)
    best = {c: _best([_values(r)[c] for r in rows if r.excluded is None], c) for c in weights}
    for r in rows:
        r.deltas = {}
        for c, v in _values(r).items():
            b = best[c]
            if v is not None and b is not None:
                r.deltas[c] = v - b
    winner = _winner(scores)
    return Comparison(rows, weights, winner, _sensitivity(rows, weights, winner))


def _best(values: list[Decimal | None], c: str) -> Decimal | None:
    known = [v for v in values if v is not None]
    if not known:
        return None
    return min(known) if LOWER_IS_BETTER[c] else max(known)


def _sensitivity(
    rows: list[Row], weights: dict[str, Decimal], winner: str | None
) -> list[dict[str, Any]]:
    """For each criterion: who wins if it mattered twice as much, or half as much."""
    out = []
    for c in weights:
        for factor in (Decimal(2), Decimal("0.5")):
            w = weights_for(
                {**{k: str(v) for k, v in weights.items()}, c: str(weights[c] * factor)}
            )
            new = _winner(_scores(rows, w))
            out.append(
                {"criterion": c, "factor": str(factor), "winner": new, "changes": new != winner}
            )
    return out
