"""Agente Analista (Haiku) — feedback editorial pós-publish.

Lê article publicado, opcionalmente compara com o que o Curador previa
(relevance/risk), e devolve um rating + lessons learned. Saída vai pro
audit_log — não modifica o article.
"""

from __future__ import annotations

from app.config import get_settings
from app.db.repositories import insert_audit_log
from app.db.types import AnalistaOutput, Article, AuditLogEntry
from app.llm.client import call_with_tool
from app.logging import get_logger

log = get_logger("agent.analista")

PROMPT_VERSION = "analista.v1"
TOOL_NAME = "register_post_review"
TOOL_DESCRIPTION = "Registra avaliação editorial pós-publicação."

SYSTEM_PROMPT = """Você é o Analista editorial do ZIMBANET — pós-publicação.

Sua função é fazer uma autocrítica do trabalho da redação AI: o pipeline
acertou no tom, na escolha do assunto, na estrutura? O que melhorar nas
próximas matérias parecidas?

Critérios:
- Aderência ao estilo editorial regional (próximo, direto, sem pomposidade).
- Acurácia factual (só com base no que está no próprio texto — não invente).
- Engajamento esperado (manchete + lede convidam a clicar?).
- Risco editorial (linguagem que poderia gerar problema?).

Entregue:
- rating: 0-10 (5 é matéria mediana, 8+ é boa, <4 é fraca).
- accuracy_assessment: 1-3 frases — o texto se sustenta nos próprios fatos?
- improvements: 2-5 melhorias específicas (não genéricas).

Use a tool 'register_post_review'."""

TOOL_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "rating": {"type": "number", "minimum": 0, "maximum": 10},
        "accuracy_assessment": {"type": "string", "minLength": 20, "maxLength": 600},
        "improvements": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 0,
            "maxItems": 8,
        },
    },
    "required": ["rating", "accuracy_assessment", "improvements"],
}


def _build_user_prompt(article: Article) -> str:
    parts = [
        f"EDITORIA: {article.editoria.value}",
        f"STATUS: {article.status.value}",
        f"TÍTULO: {article.title}",
    ]
    if article.subtitle:
        parts.append(f"SUBTÍTULO: {article.subtitle}")
    if article.lede:
        parts.append(f"LEDE: {article.lede}")
    parts += ["", "BODY:", article.body[:6000]]
    if article.tags:
        parts.append(f"\nTAGS: {', '.join(article.tags)}")
    if article.cities:
        parts.append(f"CIDADES: {', '.join(article.cities)}")
    return "\n".join(parts)


def analyze_article(
    article: Article, *, persist: bool = True
) -> AnalistaOutput:
    settings = get_settings()
    user_prompt = _build_user_prompt(article)
    result = call_with_tool(
        model=settings.model_analista,
        system=SYSTEM_PROMPT,
        user=user_prompt,
        tool_name=TOOL_NAME,
        tool_description=TOOL_DESCRIPTION,
        tool_schema=TOOL_SCHEMA,
        max_tokens=768,
        temperature=0.3,
    )
    output = AnalistaOutput.model_validate(result.output)
    log.info(
        "analista_reviewed",
        article_id=article.id,
        rating=output.rating,
        improvements_count=len(output.improvements),
    )

    if persist:
        insert_audit_log(
            AuditLogEntry(
                entity_type="article",
                entity_id=article.id,
                action="post_review",
                actor="agent",
                agent="analista",
                model=result.usage.model,
                prompt_version=PROMPT_VERSION,
                tokens_in=result.usage.tokens_in,
                tokens_out=result.usage.tokens_out,
                cost_usd=result.usage.cost_usd,
                metadata={
                    "rating": output.rating,
                    "improvements": output.improvements,
                },
            )
        )
    return output
