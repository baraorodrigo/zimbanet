"""Agente Revisor — editor-chefe automático.

Lê um rascunho recém-escrito e devolve um SELO de qualidade + pontos a revisar,
ANTES de chegar no editor humano. NÃO reescreve o texto — só dá o parecer pra o
humano focar onde importa (e pegar 'loucuras' antes de virar matéria publicada).
"""

from __future__ import annotations

from app.db.repositories import insert_audit_log, update_article_review
from app.db.types import Article, AuditLogEntry, ReviewOutput
from app.llm.client import call_with_tool
from app.logging import get_logger

log = get_logger("agent.revisor")

PROMPT_VERSION = "revisor.v1"
TOOL_NAME = "register_review"
TOOL_DESCRIPTION = "Registra o selo de revisão editorial do rascunho."

SYSTEM_PROMPT = """Você é o Editor-chefe (Revisor) do ZIMBANET — portal de Imbituba/SC.
Você NÃO reescreve a matéria. Você LÊ o rascunho e dá um parecer de qualidade pro
editor humano, apontando o que revisar antes de publicar.

Procure problemas (issues). Cada um tem 'tipo' e 'nota' curta. Tipos:
- fato_sem_fonte: afirmação factual sem fonte/atribuição clara.
- tom: clickbait, sensacionalismo, ou opinião em hard news.
- forcou_local: forçou vínculo com Imbituba/região que não existe na notícia.
- meta: o texto fala do PROCESSO editorial (curadoria, relevância, rejeição) — PROIBIDO no corpo.
- titulo_fraco: título genérico, vago ou que não fisga.
- gramatica: erro de português, frase truncada ou repetição.
- raso: parece resumo mal feito, sem desenvolvimento/contexto.
- risco: tema sensível (crime, morte, menor, vítima) sem o cuidado devido.

Entregue:
- ok: true se NÃO há problema sério (no máximo issues menores); false se precisa revisão antes de publicar.
- rating: 0 a 10 (qualidade editorial geral).
- issues: lista (pode ser vazia) de {tipo, nota}.
- summary: 1-2 frases em PT-BR resumindo o parecer pro editor.

Seja rigoroso, mas justo. Use a tool 'register_review'."""

TOOL_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "ok": {"type": "boolean"},
        "rating": {"type": "number", "minimum": 0, "maximum": 10},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string"},
                    "nota": {"type": "string"},
                },
                "required": ["tipo", "nota"],
            },
        },
        "summary": {"type": "string", "minLength": 8, "maxLength": 600},
    },
    "required": ["ok", "rating", "issues", "summary"],
}


def _user_prompt(article: Article) -> str:
    parts = [
        f"EDITORIA: {article.editoria.value}",
        f"TÍTULO: {article.title}",
    ]
    if article.subtitle:
        parts.append(f"SUBTÍTULO: {article.subtitle}")
    if article.lede:
        parts.append(f"LEDE: {article.lede}")
    parts += [
        f"CIDADES: {', '.join(article.cities or [])}",
        "",
        "CORPO:",
        article.body[:4000],
    ]
    return "\n".join(parts)


def review_article(article: Article, *, persist: bool = True) -> ReviewOutput:
    result = call_with_tool(
        slot="text_fast",
        system=SYSTEM_PROMPT,
        user=_user_prompt(article),
        tool_name=TOOL_NAME,
        tool_description=TOOL_DESCRIPTION,
        tool_schema=TOOL_SCHEMA,
        max_tokens=800,
        temperature=0.2,
    )
    output = ReviewOutput.model_validate(result.output)
    log.info(
        "article_reviewed",
        article_id=article.id,
        ok=output.ok,
        rating=output.rating,
        issues=len(output.issues),
    )
    if persist:
        update_article_review(article.id, output)
        insert_audit_log(
            AuditLogEntry(
                entity_type="article",
                entity_id=article.id,
                action="review",
                actor="agent",
                agent="revisor",
                model=result.usage.model,
                prompt_version=PROMPT_VERSION,
                tokens_in=result.usage.tokens_in,
                tokens_out=result.usage.tokens_out,
                cost_usd=result.usage.cost_usd,
                metadata={"ok": output.ok, "rating": output.rating},
            )
        )
    return output
