"""Public interface of the LLM module (ADR 0004): the only way other modules reach a model."""

from services.llm.gateway import Completion, Gateway, LlmBlocked, Provider, Result
from services.llm.ledger import PostgresLedger
from services.llm.openrouter import OpenRouterProvider, ProviderError
from services.llm.prompts import load as load_prompt
from services.llm.scripted import ScriptedProvider

__all__ = [
    "Completion",
    "Gateway",
    "LlmBlocked",
    "OpenRouterProvider",
    "PostgresLedger",
    "Provider",
    "ProviderError",
    "Result",
    "ScriptedProvider",
    "load_prompt",
]
