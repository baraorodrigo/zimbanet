"""Wrapper de LLM — força structured output, retry em rate limit / 5xx, e devolve
metadados de uso pro caller logar audit.

Despacha pelo provider resolvido a partir do slot (text_main / text_fast) via
`app.llm.resolve`:
- anthropic  → SDK Anthropic, tool use forçado.
- openrouter → API compatível com OpenAI (httpx), function calling forçado.

Os dois caminhos devolvem o mesmo `LLMResult`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx
from anthropic import APIStatusError, RateLimitError
from tenacity import (
    retry,
    retry_if_exception,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.clients import anthropic_client
from app.llm.pricing import estimate_cost_usd
from app.llm.resolve import ResolvedModel, resolve_slot
from app.logging import get_logger

log = get_logger("llm")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_HTTP_TIMEOUT = 60.0


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


# ── Anthropic ─────────────────────────────────────────────────────────────────


@retry(
    retry=retry_if_exception_type((RateLimitError, APIStatusError)),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    stop=stop_after_attempt(4),
    reraise=True,
)
def _call_anthropic(
    *,
    resolved: ResolvedModel,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    tool_schema: dict[str, Any],
    max_tokens: int,
    temperature: float,
) -> LLMResult:
    client = anthropic_client(resolved.api_key)
    response = client.messages.create(
        model=resolved.model_id,
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
            f"LLM não retornou tool_use esperado (model={resolved.model_id}, tool={tool_name})"
        )

    tool_input = getattr(tool_use, "input", {})
    usage = LLMUsage(
        model=resolved.model_id,
        tokens_in=response.usage.input_tokens,
        tokens_out=response.usage.output_tokens,
        cost_usd=estimate_cost_usd(
            resolved.model_id, response.usage.input_tokens, response.usage.output_tokens
        ),
    )
    return LLMResult(output=dict(tool_input), usage=usage)


# ── OpenRouter (compatível com OpenAI) ──────────────────────────────────────────


def _openrouter_retriable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        sc = exc.response.status_code
        return sc == 429 or 500 <= sc < 600
    return False


def _extract_json(text: str) -> dict[str, Any]:
    """Plano B: extrai o primeiro objeto JSON de um texto, pra modelos que
    respondem em prosa em vez de devolver tool_call."""
    s = text.strip()
    if s.startswith("```"):
        # remove cercas ```json ... ```
        inner = s.split("```")
        if len(inner) >= 2:
            s = inner[1]
        if s.lstrip().lower().startswith("json"):
            s = s.lstrip()[4:]
        s = s.strip("` \n")
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise RuntimeError("Resposta do modelo sem JSON estruturado nem tool_call.")
    parsed: dict[str, Any] = json.loads(s[start : end + 1])
    return parsed


@retry(
    retry=retry_if_exception(_openrouter_retriable),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    stop=stop_after_attempt(4),
    reraise=True,
)
def _call_openrouter(
    *,
    resolved: ResolvedModel,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    tool_schema: dict[str, Any],
    max_tokens: int,
    temperature: float,
) -> LLMResult:
    payload = {
        "model": resolved.model_id,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": tool_description,
                    "parameters": tool_schema,
                },
            }
        ],
        "tool_choice": {"type": "function", "function": {"name": tool_name}},
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    headers = {
        "Authorization": f"Bearer {resolved.api_key}",
        "Content-Type": "application/json",
        # OpenRouter usa esses pra atribuição/ranking — opcionais mas educados.
        "HTTP-Referer": "https://zimbanet.com",
        "X-Title": "ZIMBANET Radar",
    }
    with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
        resp = client.post(OPENROUTER_URL, json=payload, headers=headers)
    resp.raise_for_status()
    data = resp.json()

    message = data["choices"][0]["message"]
    tool_calls = message.get("tool_calls")
    if tool_calls:
        args = tool_calls[0]["function"]["arguments"]
        output = json.loads(args) if isinstance(args, str) else dict(args)
    else:
        output = _extract_json(message.get("content") or "")

    usage_data = data.get("usage") or {}
    tokens_in = int(usage_data.get("prompt_tokens", 0) or 0)
    tokens_out = int(usage_data.get("completion_tokens", 0) or 0)
    usage = LLMUsage(
        model=resolved.model_id,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_usd=estimate_cost_usd(resolved.model_id, tokens_in, tokens_out),
    )
    return LLMResult(output=output, usage=usage)


# ── Dispatch público ────────────────────────────────────────────────────────────


def call_with_tool(
    *,
    slot: str,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    tool_schema: dict[str, Any],
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> LLMResult:
    """Chama o LLM do slot (`text_main`/`text_fast`) forçando saída estruturada.

    Resolve provider+modelo+chave de app_settings (com fallback Anthropic+env) e
    despacha pro caminho do provider. Retorna sempre o mesmo `LLMResult`.
    """
    resolved = resolve_slot(slot)
    kwargs: dict[str, Any] = dict(
        resolved=resolved,
        system=system,
        user=user,
        tool_name=tool_name,
        tool_description=tool_description,
        tool_schema=tool_schema,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    if resolved.provider == "openrouter":
        result = _call_openrouter(**kwargs)
    else:
        result = _call_anthropic(**kwargs)

    log.info(
        "llm_call",
        provider=resolved.provider,
        model=resolved.model_id,
        tool=tool_name,
        tokens_in=result.usage.tokens_in,
        tokens_out=result.usage.tokens_out,
        cost_usd=round(result.usage.cost_usd, 6),
    )
    return result
