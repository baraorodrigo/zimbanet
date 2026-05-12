"""Port Python de visual-slots.ts (zimbanet-portal).

Mantém contrato com o Estúdio do portal: o admin abre /admin/estudio/<id>
e os slots já vêm pré-populados pelo radar, com defaults sensatos por
editoria. O admin refina e clica "Gerar 4 variações IA" no painel direito.

IMPORTANTE: este arquivo é o lado Python do mesmo contrato definido em
zimbanet-portal/src/lib/visual-slots.ts. Mudanças em um lado precisam
ser refletidas no outro (subject/scene/framing/mood/style/brand_tone/negative).
"""

from __future__ import annotations

from typing import Literal, TypedDict

VisualFraming = Literal["wide", "close-up", "overhead", "portrait"]
VisualMood = Literal[
    "tenso", "celebrativo", "denuncia", "comunidade", "calmo", "vibrante"
]
VisualStyle = Literal[
    "fotojornalismo", "ilustracao-editorial", "infografico", "documental"
]


class VisualSlots(TypedDict):
    subject: str
    scene: str
    framing: VisualFraming
    mood: VisualMood
    style: VisualStyle
    brand_tone: str
    negative: str


SUBJECT_MAX = 120
SCENE_MAX = 160

DEFAULT_BRAND_TONE = "navy/gold accents, off-white base, alta densidade editorial"
DEFAULT_NEGATIVE = "sem texto, sem watermark, sem clipart, sem logos"

DEFAULT_SLOTS: VisualSlots = {
    "subject": "",
    "scene": "",
    "framing": "wide",
    "mood": "comunidade",
    "style": "fotojornalismo",
    "brand_tone": DEFAULT_BRAND_TONE,
    "negative": DEFAULT_NEGATIVE,
}

# Mesmo mapa de EDITORIA_DEFAULTS do TS — manter sincronizado.
EDITORIA_DEFAULTS: dict[str, dict[str, str]] = {
    "policia": {"mood": "tenso", "style": "fotojornalismo"},
    "cultura": {"mood": "vibrante", "style": "documental"},
    "praias": {"mood": "calmo", "style": "fotojornalismo"},
    "economia": {"mood": "comunidade", "style": "documental"},
    "politica": {"mood": "comunidade", "style": "fotojornalismo"},
    "esporte": {"mood": "celebrativo", "style": "fotojornalismo"},
    "cidade": {"mood": "comunidade", "style": "documental"},
    "opiniao": {"mood": "calmo", "style": "ilustracao-editorial"},
}


def _trim_smart(s: str, max_len: int) -> str:
    s = (s or "").strip()
    if len(s) <= max_len:
        return s
    cut = s[:max_len]
    last_space = cut.rfind(" ")
    if last_space > max_len * 0.6:
        return cut[:last_space]
    return cut


def derive_default_slots(
    *,
    editoria: str,
    title: str,
    cities: list[str] | None = None,
    tags: list[str] | None = None,
) -> VisualSlots:
    """Equivalente Python de deriveDefaultSlots(article).

    Gera slots iniciais que o admin pode refinar no Estúdio sem partir do zero.
    """
    cities = cities or []
    tags = tags or []
    ed_key = (editoria or "").lower()
    ed_defaults = EDITORIA_DEFAULTS.get(
        ed_key,
        {"mood": DEFAULT_SLOTS["mood"], "style": DEFAULT_SLOTS["style"]},
    )

    city = next((c for c in cities if c), None)
    title_clean = (title or "").strip()
    subject = _trim_smart(title_clean, SUBJECT_MAX)

    if city:
        if tags:
            scene = f"Cena em {city}, no contexto de {' e '.join(tags[:2])}"
        else:
            scene = f"Cena em {city}"
    elif tags:
        scene = f"Cena no contexto de {' e '.join(tags[:2])}"
    else:
        scene = ""

    return {
        "subject": subject,
        "scene": _trim_smart(scene, SCENE_MAX),
        "framing": DEFAULT_SLOTS["framing"],
        "mood": ed_defaults["mood"],  # type: ignore[typeddict-item]
        "style": ed_defaults["style"],  # type: ignore[typeddict-item]
        "brand_tone": DEFAULT_BRAND_TONE,
        "negative": DEFAULT_NEGATIVE,
    }
