"""Agente Curador — triagem editorial.

Recebe um RawItem (notícia bruta de fonte regional) e devolve scoring +
classificação + decisão (approve / reject / investigate). Usa Haiku via tool
use pra garantir saída estruturada.
"""

from __future__ import annotations

from app.config import get_settings
from app.db.repositories import insert_audit_log, insert_scored_item
from app.db.types import AuditLogEntry, CuradorOutput, RawItem, ScoredItem
from app.llm.client import call_with_tool
from app.logging import get_logger

log = get_logger("agent.curador")

PROMPT_VERSION = "curador.v1"

SYSTEM_PROMPT = """Você é o Curador editorial do ZIMBANET — portal regional de Imbituba/SC.

Sua função é triar notícias brutas vindas de fontes regionais e decidir se entram
no fluxo editorial. Avalie cada item considerando:

- RELEVÂNCIA pra Imbituba/SC: cidade, política local, esporte regional, cultura
  local, polícia/segurança local, praias, economia regional. Notícias só de
  outras cidades sem ângulo Imbituba são baixa relevância.
- POTENCIAL DE VIRALIZAÇÃO: assunto que gera engajamento, debate, compartilhamento.
- RISCO editorial: difamação, sub judice, fake news, fonte duvidosa, conteúdo
  sensível (menores, vítimas, suicídio), promoção encoberta.

Editorias possíveis: cidade, politica, esporte, cultura, policia, praias, economia, opiniao.

DECISÃO:
- approve: relevância >= 0.6, risco < 0.4 → vai pra enriquecimento
- investigate: dúvida (relevância 0.4-0.6 ou risco 0.4-0.7) → revisão humana
- reject: relevância < 0.4 ou risco >= 0.7

Seja conciso no reasoning (máx 2 frases). Sempre use a tool 'register_curadoria'."""

TOOL_NAME = "register_curadoria"
TOOL_DESCRIPTION = "Registra a triagem editorial de um item bruto."

TOOL_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "relevance_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Relevância pra Imbituba/SC (0=irrelevante, 1=manchete).",
        },
        "virality_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Potencial de viralização local (0=ninguém liga, 1=todo mundo compartilha).",
        },
        "risk_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Risco editorial (0=seguro, 1=não publicar).",
        },
        "risk_flags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Flags como 'sub_judice', 'fonte_duvidosa', 'menor_envolvido', etc.",
        },
        "editoria": {
            "type": "string",
            "enum": [
                "cidade",
                "politica",
                "esporte",
                "cultura",
                "policia",
                "praias",
                "economia",
                "opiniao",
            ],
        },
        "classification": {
            "type": "string",
            "description": "Classificação livre curta (ex: 'obra_publica', 'temporada_verao').",
        },
        "decision": {
            "type": "string",
            "enum": ["approve", "reject", "investigate"],
        },
        "reasoning": {
            "type": "string",
            "minLength": 10,
            "maxLength": 600,
            "description": "Justificativa curta (1-2 frases).",
        },
    },
    "required": [
        "relevance_score",
        "virality_score",
        "risk_score",
        "risk_flags",
        "editoria",
        "classification",
        "decision",
        "reasoning",
    ],
}


def _build_user_prompt(item: RawItem) -> str:
    parts = [
        f"TÍTULO: {item.title}",
        f"URL: {item.url}",
    ]
    if item.published_at:
        parts.append(f"PUBLICADO EM: {item.published_at.isoformat()}")
    if item.body:
        body = item.body.strip()
        if len(body) > 2000:
            body = body[:2000] + "..."
        parts.append(f"\nCORPO:\n{body}")
    return "\n".join(parts)


def score_raw_item(item: RawItem, *, persist: bool = True) -> tuple[CuradorOutput, ScoredItem | None]:
    """Roda o Curador num RawItem. Persiste scored_item + audit_log se persist=True."""
    settings = get_settings()
    user_prompt = _build_user_prompt(item)

    result = call_with_tool(
        model=settings.model_curador,
        system=SYSTEM_PROMPT,
        user=user_prompt,
        tool_name=TOOL_NAME,
        tool_description=TOOL_DESCRIPTION,
        tool_schema=TOOL_SCHEMA,
        max_tokens=512,
        temperature=0.2,
    )

    output = CuradorOutput.model_validate(result.output)
    log.info(
        "curador_scored",
        raw_item_id=item.id,
        decision=output.decision.value,
        editoria=output.editoria.value,
        relevance=output.relevance_score,
        risk=output.risk_score,
    )

    scored: ScoredItem | None = None
    if persist:
        scored = insert_scored_item(
            raw_item_id=item.id,
            output=output,
            prompt_version=PROMPT_VERSION,
        )
        insert_audit_log(
            AuditLogEntry(
                entity_type="scored_item",
                entity_id=scored.id,
                action="score",
                actor="agent",
                agent="curador",
                model=result.usage.model,
                prompt_version=PROMPT_VERSION,
                tokens_in=result.usage.tokens_in,
                tokens_out=result.usage.tokens_out,
                cost_usd=result.usage.cost_usd,
                metadata={
                    "raw_item_id": item.id,
                    "decision": output.decision.value,
                    "editoria": output.editoria.value,
                },
            )
        )

    return output, scored
