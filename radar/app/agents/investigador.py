"""Agente Investigador (Sonnet) — enriquecimento factual.

Pega um scored_item aprovado/em-investigação e gera briefing executivo,
contexto histórico, fact-checking pontos críticos, stakeholders, sugestões
de foto e queries pra busca web. Saída persiste como enriched_item.
"""

from __future__ import annotations

from app.config import get_settings
from app.db.repositories import (
    fetch_raw_item,
    insert_audit_log,
    insert_enriched_item,
)
from app.db.types import (
    AuditLogEntry,
    EnrichedItem,
    InvestigadorOutput,
    ScoredItem,
)
from app.llm.client import call_with_tool
from app.logging import get_logger

log = get_logger("agent.investigador")

PROMPT_VERSION = "investigador.v1"
TOOL_NAME = "register_enrichment"
TOOL_DESCRIPTION = "Registra o enriquecimento factual do item."

SYSTEM_PROMPT = """Você é o Investigador editorial do ZIMBANET — portal de Imbituba/SC.

A partir de uma notícia bruta, produza um BRIEFING factual e atualizado pro
Redator usar como base. Seu trabalho não é redigir matéria — é entregar a
melhor base de fatos possível.

Entregue:
- briefing: 3-6 frases com o ESSENCIAL — quem, o quê, onde (Imbituba/SC),
  quando, por quê, com que impacto. Em PT-BR jornalístico, sem juízo de valor.
- historical_context: contexto local relevante (obras anteriores, gestões,
  estatísticas regionais). Se não houver contexto óbvio, deixe null.
- fact_check: dict com claims principais e nível de confiança ('alto', 'medio',
  'baixo'). Ex: {"creche atende 120 crianças": "alto"}.
- stakeholders: lista de pessoas/órgãos envolvidos. Cada item:
  {"nome": "...", "papel": "...", "lado": "neutro|favoravel|contra"}.
- photo_suggestions: 2-4 sugestões. Cada item:
  {"descricao": "...", "tipo": "ambiente|retrato|documento|infografico"}.
- web_searches: 2-5 queries que ajudariam um repórter a checar/aprofundar.
- confidence: 0-1, sua confiança na completude do briefing.

Regras:
- Não invente fatos. Se algo não está no material, não afirme.
- Sempre considere o ângulo Imbituba — quem da cidade é afetado?
- Use a tool 'register_enrichment'."""

TOOL_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "briefing": {"type": "string", "minLength": 40, "maxLength": 2000},
        "historical_context": {"type": ["string", "null"], "maxLength": 2000},
        "fact_check": {
            "type": "object",
            "additionalProperties": {"type": "string"},
            "description": "Dict claim → confiança (alto|medio|baixo).",
        },
        "stakeholders": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "nome": {"type": "string"},
                    "papel": {"type": "string"},
                    "lado": {"type": "string", "enum": ["neutro", "favoravel", "contra"]},
                },
                "required": ["nome", "papel"],
            },
        },
        "photo_suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "descricao": {"type": "string"},
                    "tipo": {
                        "type": "string",
                        "enum": ["ambiente", "retrato", "documento", "infografico"],
                    },
                },
                "required": ["descricao", "tipo"],
            },
        },
        "web_searches": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 0,
            "maxItems": 8,
        },
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": [
        "briefing",
        "fact_check",
        "stakeholders",
        "photo_suggestions",
        "web_searches",
        "confidence",
    ],
}


def _build_user_prompt(scored: ScoredItem, raw_title: str, raw_body: str | None, raw_url: str) -> str:
    parts = [
        f"EDITORIA SUGERIDA: {scored.editoria.value if scored.editoria else 'cidade'}",
        f"CLASSIFICAÇÃO: {scored.classification or 'n/a'}",
        f"DECISÃO CURADOR: {scored.decision.value if scored.decision else 'n/a'} (relev={scored.relevance_score}, risco={scored.risk_score})",
        f"\nTÍTULO: {raw_title}",
        f"URL: {raw_url}",
    ]
    if raw_body:
        body = raw_body.strip()
        if len(body) > 3500:
            body = body[:3500] + "..."
        parts.append(f"\nCORPO BRUTO:\n{body}")
    return "\n".join(parts)


def enrich_scored_item(
    scored: ScoredItem, *, persist: bool = True
) -> tuple[InvestigadorOutput, EnrichedItem | None]:
    settings = get_settings()
    raw = fetch_raw_item(scored.raw_item_id)
    if raw is None:
        raise RuntimeError(
            f"raw_item {scored.raw_item_id} não encontrado pra scored_item {scored.id}"
        )

    user_prompt = _build_user_prompt(scored, raw.title, raw.body, raw.url)
    result = call_with_tool(
        model=settings.model_investigador,
        system=SYSTEM_PROMPT,
        user=user_prompt,
        tool_name=TOOL_NAME,
        tool_description=TOOL_DESCRIPTION,
        tool_schema=TOOL_SCHEMA,
        max_tokens=2048,
        temperature=0.3,
    )
    output = InvestigadorOutput.model_validate(result.output)
    log.info(
        "investigador_enriched",
        scored_item_id=scored.id,
        confidence=output.confidence,
        stakeholders_count=len(output.stakeholders),
    )

    enriched: EnrichedItem | None = None
    if persist:
        enriched = insert_enriched_item(
            scored_item_id=scored.id,
            output=output,
            prompt_version=PROMPT_VERSION,
        )
        insert_audit_log(
            AuditLogEntry(
                entity_type="enriched_item",
                entity_id=enriched.id,
                action="enrich",
                actor="agent",
                agent="investigador",
                model=result.usage.model,
                prompt_version=PROMPT_VERSION,
                tokens_in=result.usage.tokens_in,
                tokens_out=result.usage.tokens_out,
                cost_usd=result.usage.cost_usd,
                metadata={
                    "scored_item_id": scored.id,
                    "confidence": output.confidence,
                },
            )
        )
    return output, enriched
