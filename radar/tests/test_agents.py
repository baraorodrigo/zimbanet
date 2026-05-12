"""Smoke tests dos agentes Investigador, Redator, Visual, Analista.

Mockam Anthropic via patch do anthropic_client + raw_item via patch
do fetch_raw_item. Não tocam Supabase (persist=False).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.db.types import (
    Article,
    ArticleStatus,
    Decision,
    Editoria,
    EnrichedItem,
    RawItem,
    ScoredItem,
    ScoredItemStatus,
)


def _mk_anthropic_response(tool_name: str, tool_input: dict) -> MagicMock:
    block = MagicMock()
    block.type = "tool_use"
    block.name = tool_name
    block.input = tool_input
    response = MagicMock()
    response.content = [block]
    response.usage.input_tokens = 400
    response.usage.output_tokens = 200
    return response


@pytest.fixture
def fake_raw() -> RawItem:
    return RawItem(
        id="raw_test_x1",
        source_id="src_imbituba",
        title="Obra do molhe da Praia da Vila começa em junho",
        body="A prefeitura confirmou o início das obras do molhe na Praia da Vila para junho de 2026, com investimento de R$ 12 milhões e prazo de 18 meses.",
        url="https://example.com/molhe-praia-vila",
        published_at=datetime(2026, 5, 9, 12, 0, tzinfo=timezone.utc),
        content_hash="ch1",
        semantic_hash="sh1",
    )


@pytest.fixture
def fake_scored() -> ScoredItem:
    return ScoredItem(
        id="scored_raw_test_x1",
        raw_item_id="raw_test_x1",
        relevance_score=0.9,
        virality_score=0.7,
        risk_score=0.1,
        risk_flags=[],
        editoria=Editoria.cidade,
        classification="obra_publica",
        decision=Decision.approve,
        ai_reasoning="Obra estruturante na Praia da Vila — alta relevância local.",
        prompt_version="curador.v1",
        status=ScoredItemStatus.scored,
        scored_at=datetime(2026, 5, 9, 13, 0, tzinfo=timezone.utc),
    )


@pytest.fixture
def fake_enriched() -> EnrichedItem:
    return EnrichedItem(
        id="enr_test_x1",
        scored_item_id="scored_raw_test_x1",
        briefing="Prefeitura inicia em junho a obra do molhe da Praia da Vila — R$ 12mi, 18 meses.",
        historical_context="Reivindicação de pescadores locais desde 2018.",
        fact_check={"valor R$ 12mi": "alto"},
        stakeholders=[
            {"nome": "Prefeitura de Imbituba", "papel": "executora", "lado": "neutro"},
        ],
        photo_suggestions=[
            {"descricao": "Vista aérea da Praia da Vila", "tipo": "ambiente"},
        ],
        web_searches=["molhe Praia da Vila Imbituba"],
        confidence=0.8,
    )


@pytest.fixture
def fake_article() -> Article:
    return Article(
        id="art_test_x1",
        scored_item_id="scored_raw_test_x1",
        enriched_item_id="enr_test_x1",
        slug="molhe-praia-da-vila-comeca-junho",
        editoria=Editoria.cidade,
        title="Obra do molhe da Praia da Vila começa em junho com investimento de R$ 12 milhões",
        lede="A prefeitura confirmou o início em junho da obra do molhe na Praia da Vila, com prazo de 18 meses.",
        body="A obra do molhe da Praia da Vila, em Imbituba, começa em junho de 2026 com investimento de R$ 12 milhões da prefeitura.\n\nO prazo previsto é de 18 meses. A demanda existe desde 2018, segundo a categoria de pescadores locais.\n\nA estrutura deve melhorar as condições de atracação e proteger a orla nas ressacas de inverno.",
        reading_minutes=2,
        tags=["imbituba", "praia-da-vila", "obra"],
        cities=["Imbituba"],
        status=ArticleStatus.draft,
    )


# ---------------------------------------------------------------- Investigador
def test_investigador_no_persist(fake_scored, fake_raw):
    fake_resp = _mk_anthropic_response(
        "register_enrichment",
        {
            "briefing": "Prefeitura confirmou início em junho do molhe da Praia da Vila com R$ 12 mi.",
            "historical_context": "Demanda antiga dos pescadores da região.",
            "fact_check": {"R$ 12 milhões": "alto", "início em junho": "alto"},
            "stakeholders": [
                {"nome": "Prefeitura de Imbituba", "papel": "executora", "lado": "neutro"}
            ],
            "photo_suggestions": [
                {"descricao": "Praia da Vila ao amanhecer", "tipo": "ambiente"}
            ],
            "web_searches": ["molhe Praia da Vila Imbituba edital"],
            "confidence": 0.78,
        },
    )
    with (
        patch("app.llm.client.anthropic_client") as mock_client_factory,
        patch("app.agents.investigador.fetch_raw_item", return_value=fake_raw),
    ):
        mock_client = MagicMock()
        mock_client.messages.create.return_value = fake_resp
        mock_client_factory.return_value = mock_client

        from app.agents.investigador import enrich_scored_item

        output, enriched = enrich_scored_item(fake_scored, persist=False)

    assert enriched is None
    assert output.confidence == pytest.approx(0.78)
    assert output.stakeholders[0]["nome"] == "Prefeitura de Imbituba"
    assert "Praia da Vila" in output.briefing


# --------------------------------------------------------------------- Redator
def test_redator_no_persist(fake_scored, fake_enriched, fake_raw):
    fake_resp = _mk_anthropic_response(
        "register_article_draft",
        {
            "slug": "molhe-praia-da-vila-comeca-junho-2026",
            "kicker": "Imbituba",
            "title": "Obra do molhe da Praia da Vila começa em junho com R$ 12 milhões",
            "subtitle": "Estrutura aguardada por pescadores locais desde 2018",
            "lede": "A prefeitura confirmou o início em junho da obra do molhe na Praia da Vila, com investimento de R$ 12 milhões e prazo de 18 meses.",
            "body": (
                "A obra do molhe da Praia da Vila começa em junho de 2026, segundo confirmação da prefeitura. "
                "O investimento é de R$ 12 milhões e o prazo previsto é de 18 meses.\n\n"
                "A demanda existe desde 2018, conforme registros da categoria de pescadores locais. "
                "A nova estrutura deve melhorar a atracação e proteger a orla nas ressacas.\n\n"
                "A prefeitura ainda não divulgou cronograma detalhado das etapas."
            ),
            "byline": "Redação ZIMBANET",
            "reading_minutes": 2,
            "hero_image_alt": "Vista aérea da Praia da Vila em Imbituba ao amanhecer",
            "tags": ["imbituba", "praia-da-vila", "obra-publica"],
            "cities": ["Imbituba"],
            "is_breaking": False,
            "is_exclusive": False,
        },
    )
    with (
        patch("app.llm.client.anthropic_client") as mock_client_factory,
        patch("app.agents.redator.fetch_raw_item", return_value=fake_raw),
    ):
        mock_client = MagicMock()
        mock_client.messages.create.return_value = fake_resp
        mock_client_factory.return_value = mock_client

        from app.agents.redator import draft_article

        output, article = draft_article(scored=fake_scored, enriched=fake_enriched, persist=False)

    assert article is None
    assert output.slug.startswith("molhe-praia-da-vila")
    assert output.reading_minutes == 2
    assert "imbituba" in output.tags


# ---------------------------------------------------------------------- Visual
def test_visual_no_persist(fake_article):
    fake_resp = _mk_anthropic_response(
        "register_visual_brief",
        {
            "hero_image_alt": "Pescadores na Praia da Vila com barcos ao fundo no fim da tarde",
            "image_prompt": "Fotojornalismo de pescadores na Praia da Vila em Imbituba, luz natural do entardecer, barcos coloridos ao fundo",
            "crop_hint": "center",
        },
    )
    with patch("app.llm.client.anthropic_client") as mock_client_factory:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = fake_resp
        mock_client_factory.return_value = mock_client

        from app.agents.visual import visualize_article

        output = visualize_article(fake_article, persist=False)

    assert output.crop_hint == "center"
    assert "Praia da Vila" in output.hero_image_alt
    assert len(output.image_prompt) >= 20


# ------------------------------------------------------------------- Analista
def test_analista_no_persist(fake_article):
    fake_resp = _mk_anthropic_response(
        "register_post_review",
        {
            "rating": 7.5,
            "accuracy_assessment": "O texto se mantém nos fatos do briefing — número, prazo e contexto histórico são consistentes.",
            "improvements": [
                "Adicionar declaração textual da prefeitura",
                "Citar a fonte do número R$ 12 milhões",
                "Incluir reação dos pescadores",
            ],
        },
    )
    with patch("app.llm.client.anthropic_client") as mock_client_factory:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = fake_resp
        mock_client_factory.return_value = mock_client

        from app.agents.analista import analyze_article

        output = analyze_article(fake_article, persist=False)

    assert output.rating == pytest.approx(7.5)
    assert len(output.improvements) == 3
