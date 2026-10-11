import json

import httpx
import pytest

from services.llm.gateway import TransientProviderError
from services.llm.openrouter import OpenRouterProvider, ProviderError


def provider(handler: httpx.MockTransport) -> OpenRouterProvider:
    return OpenRouterProvider("test-key", httpx.Client(transport=handler))


def test_sends_a_json_mode_request_and_reads_text_and_usage() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '{"answerable": false}'}}],
                "usage": {"prompt_tokens": 120, "completion_tokens": 9},
            },
        )

    out = provider(httpx.MockTransport(handle)).complete(
        model="m", prompt="p", max_tokens=50, timeout_s=5
    )
    assert (out.text, out.input_tokens, out.output_tokens) == ('{"answerable": false}', 120, 9)
    body = json.loads(seen[0].content)
    assert body["response_format"] == {"type": "json_object"} and body["temperature"] == 0
    assert seen[0].headers["authorization"] == "Bearer test-key"


@pytest.mark.parametrize("status", [429, 500, 503])
def test_rate_limits_and_server_errors_are_retryable(status: int) -> None:
    p = provider(httpx.MockTransport(lambda _: httpx.Response(status)))
    with pytest.raises(TransientProviderError):
        p.complete(model="m", prompt="p", max_tokens=5, timeout_s=5)


def test_client_errors_are_final_and_never_echo_the_body() -> None:
    p = provider(httpx.MockTransport(lambda _: httpx.Response(400, text="prompt: SECRET")))
    with pytest.raises(ProviderError) as e:
        p.complete(model="m", prompt="p", max_tokens=5, timeout_s=5)
    assert "SECRET" not in str(e.value)


def test_timeouts_become_timeout_error() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(TimeoutError):
        provider(httpx.MockTransport(handle)).complete(
            model="m", prompt="p", max_tokens=5, timeout_s=5
        )


def test_empty_key_is_refused() -> None:
    with pytest.raises(ValueError):
        OpenRouterProvider("")
