"""Agente Distribuidor (Haiku) — gera social_posts a partir de um article.

Para cada canal alvo (instagram_feed, instagram_story, whatsapp, facebook),
o Distribuidor produz caption/hashtags/text_short ajustado ao formato.
Persiste como social_post status=pending — geração de mídia visual fica
pra etapa seguinte (template engine).
"""

from __future__ import annotations

from typing import Any

from app.clients import supabase_client
from app.config import get_settings
from app.db.repositories import insert_audit_log
from app.db.types import Article, AuditLogEntry
from app.llm.client import call_with_tool
from app.logging import get_logger
from app.render import CHANNEL_TO_FORMAT, RenderError, render_card

log = get_logger("agent.distribuidor")

PROMPT_VERSION = "distribuidor.v1"
TOOL_NAME = "register_social_pack"
TOOL_DESCRIPTION = "Define caption, hashtags e text_short pra cada canal social."

SYSTEM_PROMPT = """Você é o Distribuidor social do ZIMBANET — portal de Imbituba/SC.

A partir de uma matéria publicada, você gera o pack de posts pros canais
sociais da marca. Tom: regional, próximo, sem clickbait barato. Use emoji
com parcimônia (1-2 por post, só onde agrega).

CANAIS:
- instagram_feed (card 1080x1080): caption 800-1500 chars, 5-12 hashtags,
  primeira frase tem que segurar atenção em <100 chars.
- instagram_story (1080x1920): caption curta 80-200 chars, 0-3 hashtags.
- whatsapp: text_short 200-500 chars sem hashtags, com link no final.
- facebook: caption 300-800 chars, 3-6 hashtags.

REGRAS:
- Sempre cite Imbituba (ou cidade coberta) explicitamente quando relevante.
- Hashtags: misture marca (#zimbanet #imbitubaconectada) + tema.
- NUNCA repita literal o título da matéria — reescreva pro canal.
- Não use ALL CAPS gritado.
- Se for matéria de polícia, evite tom sensacionalista.

Use a tool 'register_social_pack'."""

CHANNELS = ["instagram_feed", "instagram_story", "whatsapp", "facebook"]

TOOL_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "instagram_feed": {
            "type": "object",
            "properties": {
                "caption": {"type": "string", "minLength": 200, "maxLength": 2000},
                "hashtags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 5,
                    "maxItems": 14,
                },
            },
            "required": ["caption", "hashtags"],
        },
        "instagram_story": {
            "type": "object",
            "properties": {
                "caption": {"type": "string", "minLength": 30, "maxLength": 220},
                "hashtags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 4,
                },
            },
            "required": ["caption", "hashtags"],
        },
        "whatsapp": {
            "type": "object",
            "properties": {
                "text_short": {"type": "string", "minLength": 80, "maxLength": 600},
            },
            "required": ["text_short"],
        },
        "facebook": {
            "type": "object",
            "properties": {
                "caption": {"type": "string", "minLength": 100, "maxLength": 900},
                "hashtags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 2,
                    "maxItems": 8,
                },
            },
            "required": ["caption", "hashtags"],
        },
    },
    "required": CHANNELS,
}


def _build_user_prompt(article: Article) -> str:
    parts = [
        f"EDITORIA: {article.editoria.value}",
        f"TÍTULO: {article.title}",
    ]
    if article.subtitle:
        parts.append(f"SUBTÍTULO: {article.subtitle}")
    if article.lede:
        parts.append(f"LEDE: {article.lede}")
    parts += [
        "",
        "BODY (resumo):",
        article.body[:2500],
        "",
        f"CIDADES: {', '.join(article.cities or [])}",
        f"TAGS: {', '.join(article.tags or [])}",
        f"SLUG: {article.slug}",
    ]
    return "\n".join(parts)


def _channel_format(channel: str) -> str:
    return {
        "instagram_feed": "card_1080",
        "instagram_story": "story_1080x1920",
        "whatsapp": "text_only",
        "facebook": "banner_1200x630",
    }[channel]


def _build_render_params(article: Article, channel: str) -> dict[str, str]:
    """Mapeia campos da matéria → search params do template oficial.

    Os templates em src/app/social-template/<format>/page.tsx aceitam:
    kicker, headline, subline, editoria, photo, credit.
    """
    headline = article.title
    # Stories usam menos texto — corta agressivamente
    if channel == "instagram_story" and len(headline) > 80:
        headline = headline[:77].rstrip() + "…"

    subline = ""
    if article.subtitle:
        subline = article.subtitle
    elif article.lede:
        subline = article.lede[:160].rstrip()
        if len(article.lede) > 160:
            subline += "…"

    return {
        "kicker": article.kicker or "ZIMBANET · Imbituba conectada",
        "headline": headline,
        "subline": subline,
        "editoria": article.editoria.value,
        "photo": article.hero_image_url or "",
        "credit": article.hero_image_credit or "",
    }


def _render_pack(
    article: Article, persisted_post_ids: dict[str, str]
) -> list[dict[str, Any]]:
    """Renderiza cards via portal /api/social/render. Falhas não derrubam o pack."""
    rendered: list[dict[str, Any]] = []
    for channel, fmt in CHANNEL_TO_FORMAT.items():
        post_id = persisted_post_ids.get(channel)
        try:
            result = render_card(
                fmt=fmt,
                params=_build_render_params(article, channel),
                social_post_id=post_id,
                article_slug=article.slug,
            )
            rendered.append(
                {
                    "channel": channel,
                    "social_post_id": post_id,
                    "url": result.url,
                    "path": result.path,
                }
            )
            log.info(
                "render_success",
                article_id=article.id,
                channel=channel,
                url=result.url,
            )
        except RenderError as exc:
            log.warning(
                "render_failed",
                article_id=article.id,
                channel=channel,
                error=str(exc),
            )
            rendered.append(
                {
                    "channel": channel,
                    "social_post_id": post_id,
                    "error": str(exc),
                }
            )
    return rendered


def distribute_article(
    article: Article, *, persist: bool = True, render: bool | None = None
) -> dict[str, Any]:
    settings = get_settings()
    user_prompt = _build_user_prompt(article)
    result = call_with_tool(
        model=settings.model_visual,  # Haiku (mesmo bucket)
        system=SYSTEM_PROMPT,
        user=user_prompt,
        tool_name=TOOL_NAME,
        tool_description=TOOL_DESCRIPTION,
        tool_schema=TOOL_SCHEMA,
        max_tokens=2048,
        temperature=0.5,
    )
    pack = result.output
    log.info(
        "distribuidor_pack",
        article_id=article.id,
        channels=list(pack.keys()),
    )

    persisted_ids: list[str] = []
    persisted_by_channel: dict[str, str] = {}
    rendered: list[dict[str, Any]] = []
    if persist:
        sb = supabase_client()
        rows: list[dict[str, Any]] = []
        for channel in CHANNELS:
            content = pack.get(channel, {})
            row: dict[str, Any] = {
                "article_id": article.id,
                "channel": channel,
                "format": _channel_format(channel),
                "status": "pending",
                "prompt_version": PROMPT_VERSION,
            }
            if "caption" in content:
                row["caption"] = content["caption"]
            if "hashtags" in content:
                row["hashtags"] = content["hashtags"]
            if "text_short" in content:
                row["text_short"] = content["text_short"]
            rows.append(row)
        resp = sb.table("social_posts").insert(rows).execute()
        for inserted in resp.data or []:
            persisted_ids.append(inserted["id"])
            persisted_by_channel[inserted["channel"]] = inserted["id"]

        # Render dos templates oficiais (card/story/banner). WhatsApp não tem visual.
        should_render = settings.render_enabled if render is None else render
        if should_render:
            rendered = _render_pack(article, persisted_by_channel)

        insert_audit_log(
            AuditLogEntry(
                entity_type="article",
                entity_id=article.id,
                action="distribute",
                actor="agent",
                agent="distribuidor",
                model=result.usage.model,
                prompt_version=PROMPT_VERSION,
                tokens_in=result.usage.tokens_in,
                tokens_out=result.usage.tokens_out,
                cost_usd=result.usage.cost_usd,
                metadata={
                    "channels": list(pack.keys()),
                    "post_ids": persisted_ids,
                    "rendered": rendered,
                },
            )
        )

    return {"pack": pack, "persisted_ids": persisted_ids, "rendered": rendered}
