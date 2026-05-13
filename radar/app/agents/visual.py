"""Agente Visual (Haiku) — alt text + prompt de imagem + crop hint.

Não gera a imagem em si — produz o briefing visual que vai pra Storage/CDN.
Foco em acessibilidade (alt) e em prompts que combinem com a estética da marca.
"""

from __future__ import annotations

from app.agents.visual_slots import derive_default_slots
from app.config import get_settings
from app.db.repositories import (
    insert_audit_log,
    update_article_visual,
)
from app.db.types import Article, AuditLogEntry, VisualOutput
from app.llm.client import call_with_tool
from app.logging import get_logger

log = get_logger("agent.visual")

PROMPT_VERSION = "visual.v2"
TOOL_NAME = "register_visual_brief"
TOOL_DESCRIPTION = "Define alt-text, prompt da imagem hero e crop sugerido."

# IA = ilustração editorial, NUNCA foto realista. Em cidade pequena, imagem
# IA fotorrealista de pessoa/local real mata credibilidade — leitor reconhece
# o "falso" na hora. Decisão registrada e não-negociável.
SYSTEM_PROMPT = """Você é o agente Visual do ZIMBANET — portal de Imbituba/SC.

Sua função é traduzir uma matéria em um briefing visual coeso com a marca.

DIREÇÃO VISUAL — REGRA DURA:
- Toda imagem gerada por IA é ILUSTRAÇÃO EDITORIAL FLAT — nunca fotorrealismo.
- Referência: The New Yorker, The Atlantic, Politico — traço limpo, formas
  geométricas, paleta restrita, sem sombreado 3D, sem gradientes pesados.
- Paleta: navy #0D1B2A (dominante), dourado #E8B100 (acento), off-white #F5F5F5
  (base/fundo). Use no máximo 1-2 cores de apoio quando necessário.
- PROIBIDO: rostos fotorrealistas, pessoas identificáveis, foto de lugar real,
  estética stock photo, gradientes neon, render 3D, clipart genérico.

Entregue:
- hero_image_alt: descrição factual e acessível da imagem (PT-BR, ~140 chars).
  Se houver figura humana, descreva atividade/contexto em silhueta ou abstração,
  nunca atributos físicos identificáveis.
- image_prompt: prompt em EN (modelos rendem melhor em EN) descrevendo a CENA
  como ilustração editorial. Estrutura: [subject concreto] + [ação ou estado] +
  [ambiente Imbituba/SC abstrato] + "editorial flat illustration, navy/gold
  accents, off-white background, geometric shapes, limited palette, no 3D, no
  photorealism, no recognizable faces".
- crop_hint: 'top', 'center', 'bottom', 'left', 'right' — onde o assunto está.

Use a tool 'register_visual_brief'."""

TOOL_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "hero_image_alt": {"type": "string", "minLength": 10, "maxLength": 200},
        "image_prompt": {"type": "string", "minLength": 20, "maxLength": 600},
        "crop_hint": {
            "type": "string",
            "enum": ["top", "center", "bottom", "left", "right"],
        },
    },
    "required": ["hero_image_alt", "image_prompt", "crop_hint"],
}


def _build_user_prompt(article: Article) -> str:
    body = article.body[:1500]
    parts = [
        f"EDITORIA: {article.editoria.value}",
        f"TÍTULO: {article.title}",
    ]
    if article.subtitle:
        parts.append(f"SUBTÍTULO: {article.subtitle}")
    if article.lede:
        parts.append(f"LEDE: {article.lede}")
    parts += [f"\nCIDADES: {', '.join(article.cities or [])}", f"TAGS: {', '.join(article.tags or [])}"]
    parts += ["", "TRECHO DO BODY:", body]
    if article.hero_image_alt:
        parts += ["", f"ALT ATUAL (refinar/substituir): {article.hero_image_alt}"]
    return "\n".join(parts)


def visualize_article(
    article: Article, *, persist: bool = True
) -> VisualOutput:
    settings = get_settings()
    user_prompt = _build_user_prompt(article)
    result = call_with_tool(
        model=settings.model_visual,
        system=SYSTEM_PROMPT,
        user=user_prompt,
        tool_name=TOOL_NAME,
        tool_description=TOOL_DESCRIPTION,
        tool_schema=TOOL_SCHEMA,
        max_tokens=512,
        temperature=0.4,
    )
    output = VisualOutput.model_validate(result.output)

    # Slots iniciais pro Estúdio — mesmo contrato de visual-slots.ts.
    # Antes o admin abria /admin/estudio/<id> com tudo em branco e tinha que
    # escrever subject/scene do zero. Agora o radar já entrega defaults
    # editoria-aware (mood/style) + scene formatada com cidade + tags.
    slots: dict = dict(
        derive_default_slots(
            editoria=article.editoria.value,
            title=article.title,
            cities=article.cities,
            tags=article.tags,
        )
    )

    log.info(
        "visual_briefed",
        article_id=article.id,
        crop=output.crop_hint,
        alt_chars=len(output.hero_image_alt),
        slots_mood=slots["mood"],
        slots_style=slots["style"],
    )

    if persist:
        update_article_visual(
            article_id=article.id,
            output=output,
            visual_slots=slots,
        )
        insert_audit_log(
            AuditLogEntry(
                entity_type="article",
                entity_id=article.id,
                action="visual_brief",
                actor="agent",
                agent="visual",
                model=result.usage.model,
                prompt_version=PROMPT_VERSION,
                tokens_in=result.usage.tokens_in,
                tokens_out=result.usage.tokens_out,
                cost_usd=result.usage.cost_usd,
                metadata={
                    "crop_hint": output.crop_hint,
                    "slots_mood": slots["mood"],
                    "slots_style": slots["style"],
                },
            )
        )
    return output
