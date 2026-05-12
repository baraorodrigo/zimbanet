"""Smoke test do Curador — mocka Anthropic, não toca em Supabase."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.agents.curador import TOOL_NAME, score_raw_item
from app.db.types import Decision, Editoria, RawItem


@pytest.fixture
def fake_raw_item() -> RawItem:
    return RawItem(
        id="raw_test_001",
        source_id="src_imbituba_news",
        title="Prefeitura de Imbituba inaugura nova creche no Vila Nova",
        body="A prefeitura entregou hoje a creche que atenderá 120 crianças do bairro.",
        url="https://example.com/noticia",
        published_at=datetime(2026, 5, 9, 10, 0, tzinfo=timezone.utc),
        content_hash="hash1",
        semantic_hash="shash1",
    )


def _fake_anthropic_response() -> MagicMock:
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.name = TOOL_NAME
    tool_block.input = {
        "relevance_score": 0.85,
        "virality_score": 0.6,
        "risk_score": 0.1,
        "risk_flags": [],
        "editoria": "cidade",
        "classification": "obra_publica",
        "decision": "approve",
        "reasoning": "Inauguração de equipamento público em Imbituba — alta relevância local, baixo risco.",
    }
    response = MagicMock()
    response.content = [tool_block]
    response.usage.input_tokens = 320
    response.usage.output_tokens = 95
    return response


def test_score_raw_item_no_persist(fake_raw_item: RawItem) -> None:
    """Curador parseia tool_use e devolve CuradorOutput válido sem tocar Supabase."""
    fake_response = _fake_anthropic_response()
    with patch("app.llm.client.anthropic_client") as mock_client_factory:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = fake_response
        mock_client_factory.return_value = mock_client

        output, scored = score_raw_item(fake_raw_item, persist=False)

    assert scored is None
    assert output.decision == Decision.approve
    assert output.editoria == Editoria.cidade
    assert output.relevance_score == pytest.approx(0.85)
    assert output.risk_score == pytest.approx(0.1)
    assert "Imbituba" in output.reasoning

    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["tool_choice"] == {"type": "tool", "name": TOOL_NAME}
    assert call_kwargs["tools"][0]["name"] == TOOL_NAME
