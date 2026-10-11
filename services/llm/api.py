"""Public interface of the LLM module (ADR 0004): the only way other modules reach a model."""

from services.llm.gateway import (
    Completion,
    Gateway,
    LlmBlocked,
    Provider,
    Result,
    TransientProviderError,
)
from services.llm.ledger import PooledLedger, PostgresLedger
from services.llm.openrouter import OpenRouterProvider, ProviderError
from services.llm.prompts import load as load_prompt
from services.llm.scripted import ScriptedProvider

__all__ = [
    "Completion",
    "Gateway",
    "LlmBlocked",
    "OpenRouterProvider",
    "PooledLedger",
    "PostgresLedger",
    "Provider",
    "ProviderError",
    "Result",
    "ScriptedProvider",
    "TransientProviderError",
    "load_prompt",
]
