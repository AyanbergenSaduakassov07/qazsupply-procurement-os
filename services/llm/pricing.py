"""USD per million tokens. Source: Anthropic model table cached 2026-10-06 (claude-api skill).
Re-verify against https://platform.claude.com/docs pricing before billing clients on it."""

from decimal import Decimal

DEFAULT_MODEL = "claude-opus-5-5"

PRICES: dict[str, tuple[Decimal, Decimal]] = {
    "claude-opus-5-5": (Decimal("4.00"), Decimal("20.00")),
    "claude-sonnet-5-5": (Decimal("2.00"), Decimal("10.00")),
    "claude-haiku-5-5": (Decimal("0.10"), Decimal("0.50")),
}
MILLION = Decimal(1_000_000)


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    if model not in PRICES:
        raise KeyError(f"no price for model {model!r}; add it to services/llm/pricing.py")
    in_price, out_price = PRICES[model]
    return (input_tokens * in_price + output_tokens * out_price) / MILLION
