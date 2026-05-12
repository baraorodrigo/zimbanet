"""Agente Redator (Sonnet) — escreve a matéria pronta pra revisão.

Recebe enriched_item + scored_item + raw_item e produz article completo
(slug, title, lede, body, tags etc) status=draft. Linguagem PT-BR,
foco regional, tom direto e confiável — como o portal espera.
"""

from __future__ import annotations

from app.config import get_settings
from app.db.repositories import (
    fetch_raw_item,
    insert_article,
    insert_audit_log,
)
from app.db.types import (
    Article,
    ArticleStatus,
    AuditLogEntry,
    EnrichedItem,
    InvestigadorOutput,
    RawItem,
    RedatorOutput,
    ScoredItem,
)
from app.llm.client import call_with_tool
from app.logging import get_logger

log = get_logger("agent.redator")

PROMPT_VERSION = "redator.v1"
TOOL_NAME = "register_article_draft"
TOOL_DESCRIPTION = "Registra rascunho da matéria pra revisão editorial."

SYSTEM_PROMPT = """Você é o Redator do ZIMBANET — portal de Imbituba/SC.
Tagline: "Imbituba conectada". Cobertura: Imbituba e cidades vizinhas
(Garopaba, Laguna, Imaruí, Paulo Lopes).

Estilo editorial:
- PT-BR direto, jornalístico, MAS com calor local (sem pomposidade nem
  formalismo "quase oficial"). O leitor é vizinho, não súdito.
- Lede em até 2 frases respondendo o quê + onde + impacto.
- Body em 3-6 parágrafos. Use subtítulos só se >5 parágrafos.
- Cite fontes/stakeholders SEMPRE quando o briefing trouxer.
- NUNCA invente declarações. Se não foi dito, não é citação.
- NUNCA adjetive opinativo ("escandaloso", "absurdo") em hard news.
- Em casos de polícia, evite julgamento prévio (use "suspeito", "investigado").
- Slug: kebab-case ASCII, máx 80 chars. Sem stopwords.
- Tags: 3-6 termos curtos lowercase (ex: 'imbituba', 'praia-da-vila', 'obra').
- Cities: array com cidades cobertas (ex: ['Imbituba']).
- reading_minutes: estimativa honesta (~250 palavras/min).
- hero_image_alt: descrição factual da foto sugerida pelo Investigador.
- is_breaking: só true se for notícia de impacto imediato e quente.

Use a tool 'register_article_draft'."""

TOOL_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "slug": {"type": "string", "minLength": 8, "maxLength": 120, "pattern": r"^[a-z0-9-]+$"},
        "kicker": {"type": ["string", "null"], "maxLength": 80},
        "title": {"type": "string", "minLength": 10, "maxLength": 140},
        "subtitle": {"type": ["string", "null"], "maxLength": 200},
        "lede": {"type": "string", "minLength": 40, "maxLength": 400},
        "body": {"type": "string", "minLength": 200, "maxLength": 8000},
        "byline": {"type": ["string", "null"], "maxLength": 80},
        "reading_minutes": {"type": "integer", "minimum": 1, "maximum": 30},
        "hero_image_alt": {"type": ["string", "null"], "maxLength": 200},
        "tags": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 8},
        "cities": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 5},
        "is_breaking": {"type": "boolean"},
        "is_exclusive": {"type": "boolean"},
    },
    "required": [
        "slug",
        "title",
        "lede",
        "body",
        "reading_minutes",
        "tags",
        "cities",
        "is_breaking",
        "is_exclusive",
    ],
}


def _build_user_prompt(
    scored: ScoredItem,
    enriched: InvestigadorOutput | EnrichedItem,
    raw_title: str,
    raw_body: str | None,
    raw_url: str,
) -> str:
    if isinstance(enriched, EnrichedItem):
        briefing = enriched.briefing
        historical = enriched.historical_context
        stakeholders = enriched.stakeholders
        photo = enriched.photo_suggestions
    else:
        briefing = enriched.briefing
        historical = enriched.historical_context
        stakeholders = enriched.stakeholders
        photo = enriched.photo_suggestions

    parts = [
        f"EDITORIA: {scored.editoria.value if scored.editoria else 'cidade'}",
        f"CLASSIFICAÇÃO: {scored.classification or 'n/a'}",
        "",
        "BRIEFING FACTUAL:",
        briefing,
    ]
    if historical:
        parts += ["", "CONTEXTO HISTÓRICO:", historical]
    if stakeholders:
        parts += ["", "STAKEHOLDERS:", str(stakeholders)]
    if photo:
        parts += ["", "SUGESTÕES DE FOTO:", str(photo)]
    parts += [
        "",
        "FONTE ORIGINAL:",
        f"Título: {raw_title}",
        f"URL: {raw_url}",
    ]
    if raw_body:
        body = raw_body.strip()[:2500]
        parts += ["", "Trecho do material bruto:", body]
    return "\n".join(parts)


def draft_article(
    *,
    scored: ScoredItem,
    enriched: EnrichedItem,
    persist: bool = True,
) -> tuple[RedatorOutput, Article | None]:
    settings = get_settings()
    raw = fetch_raw_item(scored.raw_item_id)
    if raw is None:
        raise RuntimeError(f"raw_item {scored.raw_item_id} não encontrado")

    user_prompt = _build_user_prompt(scored, enriched, raw.title, raw.body, raw.url)
    result = call_with_tool(
        model=settings.model_redator,
        system=SYSTEM_PROMPT,
        user=user_prompt,
        tool_name=TOOL_NAME,
        tool_description=TOOL_DESCRIPTION,
        tool_schema=TOOL_SCHEMA,
        max_tokens=4096,
        temperature=0.5,
    )
    output = RedatorOutput.model_validate(result.output)
    log.info(
        "redator_drafted",
        scored_item_id=scored.id,
        slug=output.slug,
        words=len(output.body.split()),
        raw_image=bool(raw.image_url),
    )

    article: Article | None = None
    if persist:
        article = _persist_article(scored, enriched, output, raw)
        insert_audit_log(
            AuditLogEntry(
                entity_type="article",
                entity_id=article.id,
                action="draft",
                actor="agent",
                agent="redator",
                model=result.usage.model,
                prompt_version=PROMPT_VERSION,
                tokens_in=result.usage.tokens_in,
                tokens_out=result.usage.tokens_out,
                cost_usd=result.usage.cost_usd,
                metadata={
                    "scored_item_id": scored.id,
                    "enriched_item_id": enriched.id,
                    "slug": article.slug,
                    "raw_image_url": raw.image_url,
                },
            )
        )
    return output, article


def _persist_article(
    scored: ScoredItem,
    enriched: EnrichedItem,
    output: RedatorOutput,
    raw: RawItem,
) -> Article:
    """Insert direto no Supabase com editoria herdada do scored_item.

    Importante: copia raw.image_url -> articles.hero_image_url. Antes esse
    campo era ignorado e toda matéria nascia sem imagem; o portal exibia
    "sem mídia ainda" e o Estúdio precisava puxar do zero. Agora a foto
    extraída do RSS já vai como hero por padrão (admin pode trocar).
    """
    from app.clients import supabase_client
    from app.db.repositories import _ensure_unique_slug, update_scored_item_status
    from app.db.types import ScoredItemStatus

    sb = supabase_client()
    slug = _ensure_unique_slug(output.slug)
    editoria_value = (scored.editoria.value if scored.editoria else "cidade")
    payload = {
        "scored_item_id": scored.id,
        "enriched_item_id": enriched.id,
        "slug": slug,
        "editoria": editoria_value,
        "kicker": output.kicker,
        "title": output.title,
        "subtitle": output.subtitle,
        "lede": output.lede,
        "body": output.body,
        "byline": output.byline,
        "reading_minutes": output.reading_minutes,
        "hero_image_url": raw.image_url,
        "hero_image_credit": raw.source_id,
        "hero_image_alt": output.hero_image_alt,
        "video_url": raw.video_url,
        "tags": output.tags,
        "cities": output.cities,
        "is_breaking": output.is_breaking,
        "is_exclusive": output.is_exclusive,
        "status": ArticleStatus.draft.value,
        "risk_score": scored.risk_score,
        "confidence": enriched.confidence,
        "prompt_version": PROMPT_VERSION,
    }
    resp = sb.table("articles").insert(payload).execute()
    row = (resp.data or [None])[0]
    if row is None:
        raise RuntimeError("Falha ao inserir article")
    update_scored_item_status(scored.id, ScoredItemStatus.drafted)
    return Article.model_validate(row)
