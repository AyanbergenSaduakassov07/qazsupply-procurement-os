"""OpenRouter provider (OpenAI-compatible chat completions). DEVELOPMENT ONLY (ADR 0008).

Free OpenRouter endpoints may log or train on prompts (UNVERIFIED), so this provider is only
built when the database is local (synthetic seed data); see services.gateway.settings.
Production uses the Anthropic adapter behind the same Provider protocol (D11).
"""

import httpx

from services.llm.gateway import Completion, TransientProviderError

URL = "https://openrouter.ai/api/v1/chat/completions"


class ProviderError(Exception):
    """Non-retryable provider failure (bad request, auth, unknown model)."""


class OpenRouterProvider:
    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY is empty")
        self._key = api_key
        self._client = client or httpx.Client()

    def complete(self, *, model: str, prompt: str, max_tokens: int, timeout_s: float) -> Completion:
        try:
            response = self._client.post(
                URL,
                headers={"Authorization": f"Bearer {self._key}", "X-Title": "QazSupply (dev)"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                },
                timeout=timeout_s,
            )
        except httpx.TimeoutException as e:
            raise TimeoutError("openrouter timeout") from e
        except httpx.TransportError as e:
            raise TransientProviderError(type(e).__name__) from e
        if response.status_code == 429 or response.status_code >= 500:
            raise TransientProviderError(f"status {response.status_code}")
        if response.status_code >= 400:
            # Status only: the body may echo the prompt, which holds tenant data.
            raise ProviderError(f"status {response.status_code}")
        try:
            data = response.json()
            text = data["choices"][0]["message"]["content"] or ""
        except (ValueError, KeyError, IndexError, TypeError) as e:
            raise ProviderError("malformed response") from e
        usage = data.get("usage") or {}
        return Completion(
            text=text,
            input_tokens=int(usage.get("prompt_tokens") or 0),
            output_tokens=int(usage.get("completion_tokens") or 0),
        )
