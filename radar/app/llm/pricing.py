"""Preços de tokens em USD por 1M tokens (input, output).

Valores aproximados pra estimativa de custo. Sempre que a Anthropic atualizar
preços, ajustar aqui. Isso só serve pra observabilidade — não bloqueia chamada.
"""

PRICING_USD_PER_MTOK: dict[str, tuple[float, float]] = {
    # Claude 4.x
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-opus-4-7": (15.0, 75.0),
    # Aliases sem data
    "claude-haiku-4-5": (1.0, 5.0),
}


def estimate_cost_usd(model: str, tokens_in: int, tokens_out: int) -> float:
    price_in, price_out = PRICING_USD_PER_MTOK.get(model, (0.0, 0.0))
    return (tokens_in * price_in + tokens_out * price_out) / 1_000_000
