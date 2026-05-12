"""Detector de vídeo embedado na página de origem.

Procura links de vídeo de YouTube / Instagram / TikTok que a fonte
regional pode ter incrustado dentro do post. Estratégia em cadeia, do
mais barato pro mais caro:

1. `<meta property="og:video[:url|:secure_url]">` — quando o portal
   marca explicitamente que o post é um vídeo (raro nos regionais mas
   acontece em matéria de TV).
2. `<meta name="twitter:player">` — fallback do mesmo conceito.
3. `<iframe src="...">` apontando pra um host conhecido. É o caso
   comum: portal regional embeda Reels/YT/TikTok via WordPress.
4. `<a href="...">` quando o link bate exatamente o shape de URL
   pública de YT/IG/TT — útil pra Click Sul que às vezes coloca o
   link cru no body em vez de iframe.

Retorna a URL canônica (a mesma que `parseVideoUrl` no portal entende
sem ginástica). Sem detecção válida = `None`, e a matéria nasce sem
vídeo (admin pode colar manualmente no editor).
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup, Tag

_VIDEO_HOSTS = (
    "youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    "instagram.com",
    "tiktok.com",
)

# Shape de URL pública aceita pelo VideoEmbed do portal.
_PUBLIC_PATTERNS = (
    re.compile(r"^https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+", re.IGNORECASE),
    re.compile(r"^https?://(?:www\.)?youtube\.com/shorts/[\w-]+", re.IGNORECASE),
    re.compile(r"^https?://(?:www\.)?youtube\.com/embed/[\w-]+", re.IGNORECASE),
    re.compile(r"^https?://youtu\.be/[\w-]+", re.IGNORECASE),
    re.compile(r"^https?://(?:www\.)?instagram\.com/(?:reel|reels|p|tv)/[\w-]+", re.IGNORECASE),
    re.compile(r"^https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+", re.IGNORECASE),
)


def _has_video_host(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
    except ValueError:
        return False
    host = host.lower().lstrip("www.")
    return any(host == h or host.endswith("." + h) for h in _VIDEO_HOSTS)


def _from_meta(soup: BeautifulSoup) -> str | None:
    for prop in ("og:video", "og:video:url", "og:video:secure_url"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find(
            "meta", attrs={"name": prop}
        )
        if not isinstance(tag, Tag):
            continue
        val = tag.get("content")
        if isinstance(val, str) and val.strip() and _has_video_host(val.strip()):
            return val.strip()
    tag = soup.find("meta", attrs={"name": "twitter:player"})
    if isinstance(tag, Tag):
        val = tag.get("content")
        if isinstance(val, str) and val.strip() and _has_video_host(val.strip()):
            return val.strip()
    return None


def _from_iframe(soup: BeautifulSoup) -> str | None:
    for iframe in soup.find_all("iframe"):
        if not isinstance(iframe, Tag):
            continue
        src = iframe.get("src") or iframe.get("data-src") or iframe.get("data-lazy-src")
        if not isinstance(src, str) or not src.strip():
            continue
        src = src.strip()
        if _has_video_host(src):
            return src
    return None


def _from_anchor(soup: BeautifulSoup) -> str | None:
    """Último recurso: link cru pra YT/IG/TT no body. Click Sul faz isso."""
    for a in soup.find_all("a", href=True):
        if not isinstance(a, Tag):
            continue
        href = a.get("href")
        if not isinstance(href, str):
            continue
        href = href.strip()
        if any(p.match(href) for p in _PUBLIC_PATTERNS):
            return href
    return None


def extract_video_url(soup: BeautifulSoup) -> str | None:
    """Devolve a URL do primeiro vídeo válido encontrado, ou None."""
    return _from_meta(soup) or _from_iframe(soup) or _from_anchor(soup)
