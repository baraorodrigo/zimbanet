"""Cliente HTTP pra /api/social/render do portal Next.js.

O portal renderiza os templates oficiais (card_1080, story_1080x1920,
banner_1200x630) via Puppeteer e devolve a URL pública no Storage.
"""

from app.render.client import (
    CHANNEL_TO_FORMAT,
    RenderError,
    RenderResult,
    render_card,
)

__all__ = ["CHANNEL_TO_FORMAT", "RenderError", "RenderResult", "render_card"]
