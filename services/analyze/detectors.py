"""Deterministic finding detectors over normalised purchase lines. No LLM, no I/O.

Every finding carries: type, detector + version, saving estimate in KZT with its method in words,
confidence, the subject (item / supplier), and the exact source lines (Evidence).
Only lines with a confirmed or auto-matched item, a KZT price and a quantity take part; bundled
and rejected lines never do (Q5 default).
"""

from collections import defaultdict
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from statistics import median
from uuid import UUID

from services.analyze.config import AnalysisConfig

VERSION = "0.1.0"
CENT = Decimal("0.01")


@dataclass(frozen=True)
class Line:
    id: UUID
    item_id: UUID
    supplier_id: UUID | None
    quantity: Decimal
    unit: str | None
    price_kzt: Decimal
    purchased_on: date


@dataclass(frozen=True)
class FindingDraft:
    type: str
    saving_kzt: Decimal
    method: str
    confidence: Decimal
    item_id: UUID | None
    supplier_id: UUID | None
    line_ids: tuple[UUID, ...]
    details: dict[str, str] = field(default_factory=dict)

    @property
    def detector(self) -> str:
        return self.type


def _q(x: Decimal) -> Decimal:
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


def _conf(n: int, base: str = "0.50", step: str = "0.05", cap: str = "0.95") -> Decimal:
    return min(Decimal(cap), Decimal(base) + Decimal(step) * n)


def _by_item(lines: Iterable[Line]) -> dict[tuple[UUID, str | None], list[Line]]:
    groups: dict[tuple[UUID, str | None], list[Line]] = defaultdict(list)
    for ln in lines:
        groups[(ln.item_id, ln.unit)].append(ln)  # never compare prices across units
    return groups


def price_variance(lines: Sequence[Line], cfg: AnalysisConfig) -> list[FindingDraft]:
    out = []
    for (item, unit), group in _by_item(lines).items():
        by_supplier: dict[UUID, list[Line]] = defaultdict(list)
        for ln in group:
            if ln.supplier_id:
                by_supplier[ln.supplier_id].append(ln)
        if len(by_supplier) < 2:
            continue
        for supplier, own in by_supplier.items():
            others = [ln.price_kzt for s, ls in by_supplier.items() if s != supplier for ln in ls]
            if (
                len(own) < cfg.price_variance_min_lines
                or len(others) < cfg.price_variance_min_lines
            ):
                continue
            ref = Decimal(median(others))
            # The supplier's typical price is its median: one spike must not make a supplier
            # "overpriced" (that is an outlier finding instead).
            mean = Decimal(median(ln.price_kzt for ln in own))
            if ref <= 0 or mean <= ref * (1 + cfg.price_variance_min_pct):
                continue
            over = [ln for ln in own if ln.price_kzt > ref]
            saving = _q(sum(((ln.price_kzt - ref) * ln.quantity for ln in over), Decimal(0)))
            if saving <= 0:
                continue
            out.append(
                FindingDraft(
                    "price_variance",
                    saving,
                    "sum over this supplier's lines of "
                    "(price - median price of other suppliers) x quantity",
                    _conf(min(len(own), len(others))),
                    item,
                    supplier,
                    tuple(
                        sorted(
                            ln.id
                            for ln in own
                            + [x for s, ls in by_supplier.items() if s != supplier for x in ls]
                        )
                    ),
                    {
                        "reference_median_kzt": str(_q(ref)),
                        "supplier_median_kzt": str(_q(mean)),
                        "premium_pct": str(_q((mean / ref - 1) * 100)),
                        "unit": unit or "",
                    },
                )
            )
    return out


def outliers(lines: Sequence[Line], cfg: AnalysisConfig) -> list[FindingDraft]:
    out = []
    for (item, unit), group in _by_item(lines).items():
        if len(group) < cfg.outlier_min_lines:
            continue
        prices = sorted(ln.price_kzt for ln in group)
        q1, q3 = _quantile(prices, Decimal("0.25")), _quantile(prices, Decimal("0.75"))
        med = Decimal(median(prices))
        fence = max(q3 + cfg.outlier_iqr_k * (q3 - q1), med * (1 + cfg.outlier_min_premium))
        for ln in group:
            if ln.price_kzt > fence and fence > 0:
                saving = _q((ln.price_kzt - med) * ln.quantity)
                out.append(
                    FindingDraft(
                        "outlier",
                        saving,
                        "(price - median price of the item) x quantity, for a price above "
                        "both Q3 + k x IQR and the median + minimum premium",
                        _conf(len(group), base="0.40"),
                        item,
                        ln.supplier_id,
                        (ln.id,),
                        {
                            "median_kzt": str(_q(med)),
                            "fence_kzt": str(_q(fence)),
                            "unit": unit or "",
                        },
                    )
                )
    return out


def repeat_purchases(lines: Sequence[Line], cfg: AnalysisConfig) -> list[FindingDraft]:
    out = []
    pairs: dict[tuple[UUID, UUID], list[Line]] = defaultdict(list)
    for ln in lines:
        if ln.supplier_id:
            pairs[(ln.item_id, ln.supplier_id)].append(ln)
    for (item, supplier), group in pairs.items():
        group.sort(key=lambda ln: ln.purchased_on)
        best: list[Line] = []
        start = 0
        for end in range(len(group)):
            while group[end].purchased_on - group[start].purchased_on > timedelta(
                days=cfg.repeat_window_days
            ):
                start += 1
            if end - start + 1 > len(best):
                best = group[start : end + 1]
        if len(best) < cfg.repeat_min_orders:
            continue
        spend = sum((ln.price_kzt * ln.quantity for ln in best), Decimal(0))
        out.append(
            FindingDraft(
                "repeat_purchase",
                _q(spend * cfg.repeat_consolidation_discount),
                f"ASSUMPTION: consolidating {len(best)} orders saves "
                f"{cfg.repeat_consolidation_discount:%} of their spend",
                Decimal("0.50"),
                item,
                supplier,
                tuple(ln.id for ln in best),
                {
                    "orders": str(len(best)),
                    "spend_kzt": str(_q(spend)),
                    "window_days": str(cfg.repeat_window_days),
                },
            )
        )
    return out


def split_purchases(lines: Sequence[Line], cfg: AnalysisConfig) -> list[FindingDraft]:
    out = []
    pairs: dict[tuple[UUID, UUID], list[Line]] = defaultdict(list)
    for ln in lines:
        if ln.supplier_id:
            pairs[(ln.item_id, ln.supplier_id)].append(ln)
    limit = cfg.split_approval_limit_kzt
    for (item, supplier), group in pairs.items():
        small = sorted(
            (ln for ln in group if ln.price_kzt * ln.quantity < limit),
            key=lambda ln: ln.purchased_on,
        )
        start, flagged = 0, None
        for end in range(len(small)):
            while small[end].purchased_on - small[start].purchased_on > timedelta(
                days=cfg.split_window_days
            ):
                start += 1
            window = small[start : end + 1]
            total = sum((ln.price_kzt * ln.quantity for ln in window), Decimal(0))
            if len(window) >= 2 and total >= limit:
                flagged = (window, total)
        if flagged:
            window, total = flagged
            out.append(
                FindingDraft(
                    "split_purchase",
                    Decimal("0.00"),
                    "orders each below the approval limit that together exceed it "
                    "(compliance risk; no saving claimed)",
                    Decimal("0.70"),
                    item,
                    supplier,
                    tuple(ln.id for ln in window),
                    {
                        "orders": str(len(window)),
                        "total_kzt": str(_q(total)),
                        "limit_kzt": str(limit),
                    },
                )
            )
    return out


def concentration(lines: Sequence[Line], cfg: AnalysisConfig) -> list[FindingDraft]:
    out = []
    by_item: dict[UUID, list[Line]] = defaultdict(list)
    for ln in lines:
        if ln.supplier_id:
            by_item[ln.item_id].append(ln)
    for item, group in by_item.items():
        spend: dict[UUID, Decimal] = defaultdict(Decimal)
        for ln in group:
            assert ln.supplier_id is not None
            spend[ln.supplier_id] += ln.price_kzt * ln.quantity
        total = sum(spend.values(), Decimal(0))
        if total < cfg.concentration_min_spend_kzt or len(group) < 3:
            continue
        top, top_spend = max(spend.items(), key=lambda kv: kv[1])
        share = top_spend / total
        if share >= cfg.concentration_share:
            out.append(
                FindingDraft(
                    "concentration",
                    Decimal("0.00"),
                    "one supplier's share of the item's spend (supply risk; no saving claimed)",
                    Decimal("0.80"),
                    item,
                    top,
                    tuple(ln.id for ln in group if ln.supplier_id == top),
                    {
                        "share_pct": str(_q(share * 100)),
                        "item_spend_kzt": str(_q(total)),
                        "suppliers": str(len(spend)),
                    },
                )
            )
    return out


DETECTORS: tuple[Callable[[Sequence[Line], AnalysisConfig], list[FindingDraft]], ...] = (
    price_variance,
    outliers,
    repeat_purchases,
    split_purchases,
    concentration,
)


def run_all(lines: Sequence[Line], cfg: AnalysisConfig) -> list[FindingDraft]:
    drafts = [d for detector in DETECTORS for d in detector(lines, cfg)]
    # Never count the same money twice: an outlier line of a supplier already flagged for price
    # variance on that item is part of that finding's saving.
    by_id = {ln.id: ln for ln in lines}
    explained = {
        line_id
        for d in drafts
        if d.type == "price_variance"
        for line_id in d.line_ids
        if by_id[line_id].supplier_id == d.supplier_id
    }
    drafts = [d for d in drafts if not (d.type == "outlier" and d.line_ids[0] in explained)]
    return sorted(drafts, key=lambda d: (-d.saving_kzt, d.type, str(d.item_id), str(d.supplier_id)))


def _quantile(sorted_values: Sequence[Decimal], q: Decimal) -> Decimal:
    """Linear interpolation (same as numpy 'linear' and Postgres percentile_cont)."""
    pos = (len(sorted_values) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(sorted_values) - 1)
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (pos - lo)
