"""Rules-first supplier risk score (CONTEXT: Risk score). Not a credit rating.

Every factor is a named rule with a visible weight; an org may override any weight in
organizations.risk_config (0 switches a factor off). The score is the sum of triggered weights,
capped at 100. No model touches the score. A confirmed sanctions hit always means high risk,
whatever the weights; an unanswered question (source down, never screened) is "unknown",
never "ok".
"""

from dataclasses import dataclass
from typing import Any

# Defaults, documented here; changing one changes verdicts for every org without an override.
WEIGHTS: dict[str, int] = {
    "sanctions_confirmed": 100,  # human-confirmed hit, supplier or related party
    "sanctions_open": 40,  # a possible sanctions match nobody has decided yet
    "pep_related": 15,  # a related person is a politically exposed person (open or confirmed)
    "unreliable_supplier": 50,  # listed in the unreliable-supplier registry (РНУ)
    "not_active": 60,  # registry status is not "active" (liquidated, suspended, ...)
    "young_company": 10,  # registered less than 2 years ago
    "foreign_owner": 10,  # an owner company is registered outside Kazakhstan
    "no_beneficial_owner": 20,  # the registry names no beneficial owner
    "dual_use_goods": 20,  # goods bought from it match a dual-use control
    "screening_stale": 10,  # last screening older than 30 days
}
HIGH, CAUTION = 60, 20


@dataclass(frozen=True)
class Factor:
    code: str
    weight: int
    triggered: bool
    detail: dict[str, Any]

    @property
    def points(self) -> int:
        return self.weight if self.triggered else 0


@dataclass(frozen=True)
class Risk:
    score: int
    verdict: str  # ok | caution | high_risk | unknown
    factors: list[Factor]

    @property
    def top(self) -> list[Factor]:
        return sorted((f for f in self.factors if f.points), key=lambda f: -f.points)[:3]


def weights_for(overrides: dict[str, Any] | None) -> dict[str, int]:
    out = dict(WEIGHTS)
    for key, raw in (overrides or {}).items():
        if key in out:
            out[key] = max(0, min(100, int(raw)))
    return out


def assess(
    signals: dict[str, dict[str, Any] | None], weights: dict[str, int], *, known: bool
) -> Risk:
    """signals: factor code -> detail dict when the rule fired, None when it did not.

    known=False (registry unavailable or never screened) forces the verdict to "unknown".
    """
    factors = [
        Factor(
            code,
            weights[code],
            signals.get(code) is not None and weights[code] > 0,
            signals.get(code) or {},
        )
        for code in WEIGHTS
    ]
    score = min(100, sum(f.points for f in factors))
    if signals.get("sanctions_confirmed") is not None:
        verdict = "high_risk"
    elif not known:
        verdict = "unknown"
    elif score >= HIGH:
        verdict = "high_risk"
    elif score >= CAUTION:
        verdict = "caution"
    else:
        verdict = "ok"
    return Risk(score, verdict, factors)
