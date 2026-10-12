"""Typed source failures every connector raises, so domain code can show a degraded state
("source down since ..., showing data from ...") instead of a crash or a silent gap."""

from dataclasses import dataclass
from typing import Literal

Reason = Literal["down", "rate_limited", "schema_drift"]


@dataclass(frozen=True)
class SourceUnavailable(Exception):  # noqa: N818 - a state, not a programming error
    source_id: str
    reason: Reason
    retry_after_s: int | None = None

    def __str__(self) -> str:
        return f"{self.source_id}: {self.reason}"


def require(source_id: str, payload: object, keys: tuple[str, ...]) -> dict[str, object]:
    """Schema-drift guard: the payload must be an object with these keys."""
    if not isinstance(payload, dict) or any(k not in payload for k in keys):
        raise SourceUnavailable(source_id, "schema_drift")
    return payload
