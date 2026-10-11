"""Public interface of the LLM module (ADR 0004): the only way other modules reach a model."""

from services.llm.gateway import Completion, Gateway, LlmBlocked, Provider, Result
from services.llm.ledger import PostgresLedger
from services.llm.openrouter import OpenRouterProvider, ProviderError

__all__ = [
    "Completion",
    "Gateway",
    "LlmBlocked",
    "OpenRouterProvider",
    "PostgresLedger",
    "Provider",
    "ProviderError",
    "Result",
]
