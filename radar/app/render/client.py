"""HTTP client pro /api/social/render do portal."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.config import get_settings
from app.logging import get_logger

log = get_logger("render.client")

Format = Literal["card-1080", "story-1080x1920", "banner-1200x630"]

# Mapeia o canal social_posts → formato no template
CHANNEL_TO_FORMAT: dict[str, Format] = {
    "instagram_feed": "card-1080",
    "instagram_story": "story-1080x1920",
    "facebook": "banner-1200x630",
}


class RenderError(Exception):
    """Erro chamando /api/social/render."""


@dataclass
class RenderResult:
    url: str
    path: str
    format: str


def render_card(
    *,
    fmt: Format,
    params: dict[str, str],
    social_post_id: str | None = None,
    article_slug: str | None = None,
    timeout_s: float = 60.0,
) -> RenderResult:
    """Pede ao portal que renderize um card. Atualiza social_posts se id veio."""
    settings = get_settings()
    base = settings.portal_base_url.rstrip("/")
    url = f"{base}/api/social/render"

    payload: dict[str, Any] = {
        "format": fmt,
        "params": {k: v for k, v in params.items() if v},
    }
    if social_post_id:
        payload["social_post_id"] = social_post_id
    if article_slug:
        payload["article_slug"] = article_slug

    headers = {"content-type": "application/json"}
    if settings.render_api_token:
        headers["x-render-token"] = settings.render_api_token

    try:
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise RenderError(f"transport: {exc}") from exc

    if resp.status_code >= 400:
        # 207 = multi-status (renderou mas falhou ao atualizar social_post)
        if resp.status_code == 207:
            data = resp.json()
            log.warning(
                "render_partial_failure",
                detail=data.get("detail"),
                warning=data.get("warning"),
            )
            return RenderResult(url=data["url"], path=data["path"], format=fmt)
        try:
            err = resp.json()
        except Exception:
            err = {"error": resp.text[:200]}
        raise RenderError(f"{resp.status_code}: {err}")

    data = resp.json()
    return RenderResult(url=data["url"], path=data["path"], format=fmt)
