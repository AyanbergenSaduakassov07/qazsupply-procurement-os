"""Analysis thresholds. Defaults are documented here; each org may override any key in
organizations.analysis_config (validated against this dataclass). Changing a default changes
findings for every org that did not override it, so it ships with a precision re-run."""

from dataclasses import dataclass, fields, replace
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class AnalysisConfig:
    # price_variance: a supplier's median price exceeds the median of OTHER suppliers by this share
    price_variance_min_pct: Decimal = Decimal("0.10")
    price_variance_min_lines: int = 2  # per side (this supplier, other suppliers)
    # outlier: price above Q3 + k * IQR of the item's price history AND above median * (1 + premium)
    outlier_iqr_k: Decimal = Decimal("1.5")
    outlier_min_lines: int = 5
    outlier_min_premium: Decimal = Decimal("0.30")  # and at least 30% above the item's median
    # repeat_purchase: >= min orders of one item from one supplier within the window
    repeat_min_orders: int = 4
    repeat_window_days: int = 90
    # ASSUMPTION, labelled in every finding: typical saving from consolidating orders
    repeat_consolidation_discount: Decimal = Decimal("0.05")
    # split_purchase: several orders each below the approval limit that together exceed it
    split_approval_limit_kzt: Decimal = Decimal("1000000")  # UNVERIFIED: org-specific policy
    split_window_days: int = 14
    # concentration: one supplier's share of an item's spend
    concentration_share: Decimal = Decimal("0.80")
    concentration_min_spend_kzt: Decimal = Decimal("500000")

    @classmethod
    def for_org(cls, overrides: dict[str, Any] | None) -> "AnalysisConfig":
        known = {f.name: f.type for f in fields(cls)}
        values: dict[str, Any] = {}
        for key, raw in (overrides or {}).items():
            if key not in known:
                continue  # unknown keys are ignored, never fatal
            default = getattr(cls(), key)
            values[key] = type(default)(str(raw)) if isinstance(default, Decimal) else int(raw)
        return replace(cls(), **values)
