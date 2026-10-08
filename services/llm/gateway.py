"""The only path to a language model (ADR 0004).

Order of checks: kill switch -> tenant budget -> render (redacted, escaped) -> provider call with
timeout and bounded retries -> ledger record. Every attempt that reaches the budget check is
recorded, including blocked ones, so spend and refusals are auditable per tenant.
"""

import logging
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from services.llm import prompts
from services.llm.pricing import DEFAULT_MODEL, cost_usd
from services.llm.redact import redact

logger = logging.getLogger("llm")


@dataclass(frozen=True)
class Completion:
    text: str
    input_tokens: int
    output_tokens: int


class TransientProviderError(Exception):
    """Retryable: rate limit, overload, connection reset."""


class Provider(Protocol):
    def complete(
        self, *, model: str, prompt: str, max_tokens: int, timeout_s: float
    ) -> Completion: ...


@dataclass(frozen=True)
class CallRecord:
    org_id: UUID
    task: str
    prompt_version: str
    prompt_sha256: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    redacted: bool
    latency_ms: int
    status: str


class Ledger(Protocol):
    def month_spend_usd(self, org_id: UUID) -> Decimal: ...
    def monthly_budget_usd(self, org_id: UUID) -> Decimal: ...
    def record(self, call: CallRecord) -> None: ...


class LlmBlocked(Exception):
    def __init__(self, status: str) -> None:
        super().__init__(status)
        self.status = status


@dataclass(frozen=True)
class Result:
    text: str
    cost_usd: Decimal
    redacted: bool


def kill_switch_on() -> bool:
    return os.environ.get("LLM_KILL_SWITCH", "false").strip().lower() in {"1", "true", "yes", "on"}


class Gateway:
    def __init__(
        self,
        provider: Provider,
        ledger: Ledger,
        *,
        timeout_s: float = 60.0,
        max_retries: int = 2,
        backoff_s: float = 1.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._provider, self._ledger = provider, ledger
        self._timeout_s, self._max_retries = timeout_s, max_retries
        self._backoff_s, self._sleep = backoff_s, sleep

    def run(
        self,
        *,
        org_id: UUID,
        task: str,
        version: str,
        variables: dict[str, str],
        model: str = DEFAULT_MODEL,
        max_tokens: int = 1024,
    ) -> Result:
        prompt = prompts.load(task, version)
        cleaned: dict[str, str] = {}
        redacted_any = False
        for name, value in variables.items():
            cleaned[name], changed = redact(value)
            redacted_any = redacted_any or changed
        text = prompts.render(prompt, cleaned)

        def record(status: str, completion: Completion | None, started: float) -> None:
            tokens_in = completion.input_tokens if completion else 0
            tokens_out = completion.output_tokens if completion else 0
            self._ledger.record(
                CallRecord(
                    org_id=org_id,
                    task=task,
                    prompt_version=version,
                    prompt_sha256=prompt.sha256,
                    model=model,
                    input_tokens=tokens_in,
                    output_tokens=tokens_out,
                    cost_usd=cost_usd(model, tokens_in, tokens_out),
                    redacted=redacted_any,
                    latency_ms=int((time.monotonic() - started) * 1000),
                    status=status,
                )
            )

        started = time.monotonic()
        if kill_switch_on():
            record("blocked_kill_switch", None, started)
            raise LlmBlocked("blocked_kill_switch")
        if self._ledger.month_spend_usd(org_id) >= self._ledger.monthly_budget_usd(org_id):
            record("blocked_budget", None, started)
            raise LlmBlocked("blocked_budget")

        for attempt in range(self._max_retries + 1):
            try:
                completion = self._provider.complete(
                    model=model, prompt=text, max_tokens=max_tokens, timeout_s=self._timeout_s
                )
            except (TransientProviderError, TimeoutError) as e:
                if attempt == self._max_retries:
                    record("timeout" if isinstance(e, TimeoutError) else "error", None, started)
                    raise
                logger.warning("llm retry", extra={"error_type": type(e).__name__})
                self._sleep(self._backoff_s * 2**attempt)
                continue
            except Exception:
                record("error", None, started)
                raise
            record("ok", completion, started)
            return Result(
                text=completion.text,
                cost_usd=cost_usd(model, completion.input_tokens, completion.output_tokens),
                redacted=redacted_any,
            )
        raise AssertionError("unreachable")  # pragma: no cover
