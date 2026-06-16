"""Testa o caminho OpenRouter do client de LLM (mock HTTP via respx)."""

from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest
import respx

from app.llm.client import OPENROUTER_URL, call_with_tool
from app.llm.resolve import ResolvedModel

SCHEMA: dict = {
    "type": "object",
    "properties": {"x": {"type": "string"}},
    "required": ["x"],
}


def _resolved_or() -> ResolvedModel:
    return ResolvedModel(
        provider="openrouter",
        model_id="deepseek/deepseek-v4-flash",
        api_key="sk-or-test",
    )


def _call() -> object:
    return call_with_tool(
        slot="text_fast",
        system="s",
        user="u",
        tool_name="t",
        tool_description="d",
        tool_schema=SCHEMA,
    )


@respx.mock
def test_openrouter_parses_tool_call() -> None:
    route = respx.post(OPENROUTER_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"tool_calls": [{"function": {"name": "t", "arguments": '{"x": "oi"}'}}]}}
                ],
                "usage": {"prompt_tokens": 12, "completion_tokens": 4},
            },
        )
    )
    with patch("app.llm.client.resolve_slot", return_value=_resolved_or()):
        res = _call()
    assert res.output == {"x": "oi"}
    assert res.usage.tokens_in == 12
    assert res.usage.tokens_out == 4
    assert route.called
    # confere que mandou function calling forçado
    sent = route.calls.last.request
    assert b'"tool_choice"' in sent.content


@respx.mock
def test_openrouter_json_fallback_from_content() -> None:
    respx.post(OPENROUTER_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": 'claro, aqui: {"x": "oi"} pronto'}}],
                "usage": {},
            },
        )
    )
    with patch("app.llm.client.resolve_slot", return_value=_resolved_or()):
        res = _call()
    assert res.output == {"x": "oi"}


@respx.mock
def test_openrouter_4xx_raises_with_body() -> None:
    respx.post(OPENROUTER_URL).mock(
        return_value=httpx.Response(400, text='{"error":{"message":"tool_choice nao suportado"}}')
    )
    with (
        patch("app.llm.client.resolve_slot", return_value=_resolved_or()),
        pytest.raises(RuntimeError, match="tool_choice nao suportado"),
    ):
        _call()


@respx.mock
def test_openrouter_200_with_error_body_raises() -> None:
    respx.post(OPENROUTER_URL).mock(
        return_value=httpx.Response(200, json={"error": {"message": "provider down"}})
    )
    with (
        patch("app.llm.client.resolve_slot", return_value=_resolved_or()),
        pytest.raises(RuntimeError, match="provider down"),
    ):
        _call()


@respx.mock
def test_openrouter_raises_when_no_json() -> None:
    respx.post(OPENROUTER_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": "sem json nenhum aqui"}}], "usage": {}},
        )
    )
    with (
        patch("app.llm.client.resolve_slot", return_value=_resolved_or()),
        pytest.raises(RuntimeError),
    ):
        _call()
