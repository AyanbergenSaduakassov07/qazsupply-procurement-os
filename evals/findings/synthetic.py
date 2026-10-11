"""Synthetic spend datasets with PLANTED findings, for detector precision/recall.

Owner's two hand-audited datasets are the real M2 gate; until they exist this measures whether the
detectors find what was planted and stay quiet on noise (+-4% price jitter). Deterministic per seed.
"""

import random
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from services.analyze.detectors import Line


@dataclass(frozen=True)
class Plant:
    type: str
    item: uuid.UUID
    supplier: uuid.UUID | None
    line: uuid.UUID | None = None


@dataclass(frozen=True)
class Dataset:
    name: str
    lines: list[Line]
    plants: list[Plant]


def build(seed: int, items: int = 30, suppliers: int = 6) -> Dataset:
    rng = random.Random(seed)
    item_ids = [uuid.UUID(int=rng.getrandbits(128)) for _ in range(items)]
    sup_ids = [uuid.UUID(int=rng.getrandbits(128)) for _ in range(suppliers)]
    lines: list[Line] = []
    plants: list[Plant] = []
    start = date(2026, 1, 1)

    def add(item: uuid.UUID, sup: uuid.UUID, price: Decimal, qty: int, day: int) -> Line:
        ln = Line(
            uuid.UUID(int=rng.getrandbits(128)),
            item,
            sup,
            Decimal(qty),
            "pcs",
            price.quantize(Decimal("0.01")),
            start + timedelta(days=day),
        )
        lines.append(ln)
        return ln

    for idx, item in enumerate(item_ids):
        base = Decimal(rng.randint(500, 50_000))
        chosen = rng.sample(sup_ids, 3)
        # Background: 3 suppliers, orders >= 40 days apart (no repeats/splits), +-4% jitter.
        qty = rng.randint(2, 10)  # same volume per supplier: no accidental concentration
        for s_i, sup in enumerate(chosen):
            for k in range(2):
                jitter = Decimal(1 + rng.uniform(-0.04, 0.04))
                add(item, sup, base * jitter, qty, 40 * k + 7 * s_i + rng.randint(0, 3))
        if idx % 5 == 0:  # overpriced supplier: +25..40%
            sup = chosen[0]
            for k in range(2):
                add(
                    item,
                    sup,
                    base * Decimal(1 + rng.uniform(0.25, 0.40)),
                    rng.randint(1, 20),
                    120 + 40 * k,
                )
            plants.append(Plant("price_variance", item, sup))
        if idx % 7 == 1:  # one wild outlier (x4)
            ln = add(item, chosen[1], base * 4, rng.randint(1, 5), 200)
            plants.append(Plant("outlier", item, chosen[1], ln.id))
        if idx % 9 == 2:  # split: several orders just under the 1M approval limit within 10 days
            sup = chosen[2]
            qty = max(1, int(Decimal(900_000) / base))  # at the item's normal price, just under 1M
            for d in range(3):
                add(item, sup, base, qty, 250 + d * 3)
            plants.append(Plant("split_purchase", item, sup))
        if idx % 11 == 3:  # repeat purchases: 5 orders within 60 days from one supplier
            sup = chosen[1]
            for d in range(5):
                add(item, sup, base, rng.randint(1, 3), 300 + d * 12)
            plants.append(Plant("repeat_purchase", item, sup))
    # Concentration: one extra item bought almost only from one supplier.
    conc_item, conc_sup, other = uuid.UUID(int=rng.getrandbits(128)), sup_ids[0], sup_ids[1]
    for d in range(4):
        add(conc_item, conc_sup, Decimal(250_000), 2, 40 * d)
    add(conc_item, other, Decimal(250_000), 1, 30)
    plants.append(Plant("concentration", conc_item, conc_sup))
    return Dataset(f"synthetic-{seed}", lines, plants)


def _ds1() -> Dataset:
    return build(101)


def _ds2() -> Dataset:
    return build(202, items=40, suppliers=8)


DATASETS = (_ds1, _ds2)
