"""Wrapper sobre Anthropic — força structured output via tool use, retry em
rate limits / 5xx, e devolve metadados de uso pro caller logar audit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from anthropic import APIStatusError, RateLimitError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.clients import anthropic_client
from app.llm.pricing import estimate_cost_usd
from app.logging import get_logger

log = get_logger("llm")


@dataclass(slots=True)
class LLMUsage:
    model: str
    tokens_in: int
    tokens_out: int
    cost_usd: float


@dataclass(slots=True)
class LLMResult:
    output: dict[str, Any]
    usage: LLMUsage
    raw_text: str | None = None


def _is_retriable(exc: BaseException) -> bool:
    if isinstance(exc, RateLimitError):
        return True
    if isinstance(exc, APIStatusError):
        return 500 <= exc.status_code < 600
    return False


@retry(
    retry=retry_if_exception_type((RateLimitError, APIStatusError)),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    stop=stop_after_attempt(4),
    reraise=True,
)
def call_with_tool(
    *,
    model: str,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    tool_schema: dict[str, Any],
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> LLMResult:
    """Chama Claude forçando o uso de uma tool — garante JSON estruturado."""
    client = anthropic_client()
    response = client.messages.create(
        model=model,
        system=system,
        messages=[{"role": "user", "content": user}],
        tools=[
            {
                "name": tool_name,
                "description": tool_description,
                "input_schema": tool_schema,
            }
        ],
        tool_choice={"type": "tool", "name": tool_name},
        max_tokens=max_tokens,
        temperature=temperature,
    )

    tool_use = next(
        (b for b in response.content if getattr(b, "type", None) == "tool_use"), None
    )
    if tool_use is None:
        raise RuntimeError(
            f"LLM não retornou tool_use esperado (model={model}, tool={tool_name})"
        )

    usage = LLMUsage(
        model=model,
        tokens_in=response.usage.input_tokens,
        tokens_out=response.usage.output_tokens,
        cost_usd=estimate_cost_usd(
            model, response.usage.input_tokens, response.usage.output_tokens
        ),
    )
    log.info(
        "llm_call",
        model=model,
        tool=tool_name,
        tokens_in=usage.tokens_in,
        tokens_out=usage.tokens_out,
        cost_usd=round(usage.cost_usd, 6),
    )
    return LLMResult(output=dict(tool_use.input), usage=usage)
