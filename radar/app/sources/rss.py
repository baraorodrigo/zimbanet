"""Adapter RSS — feedparser + filtro por keywords opcional.

Imagem do item: cadeia de fallbacks. As fontes regionais (G1, NSC, ND+,
Imbituba prefeitura etc) variam muito no que expõem no feed — algumas
mandam <media:content>, outras só <enclosure>, outras embutem o <img>
dentro do content:encoded ou nem isso. Antes a gente só lia
media_content/media_thumbnail e perdia 60-70% das fotos; depois esse
campo virava NULL no Supabase e a matéria nascia sem hero, forçando o
admin a puxar do zero no Estúdio. Agora vamos até a página original
buscar og:image como último recurso.
"""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from typing import Any

import feedparser
import httpx
from bs4 import BeautifulSoup, Tag

from app.db.types import Source
from app.logging import get_logger
from app.sources.dedup import content_hash, make_raw_id, semantic_hash

log = get_logger("sources.rss")

_IMG_TAG_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)
_OG_FETCH_TIMEOUT = 3.0
_OG_USER_AGENT = "ZimbanetRadar/0.1 (+https://zimbanet.com.br)"


def _entry_published(entry: Any) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        struct = getattr(entry, key, None) or entry.get(key) if isinstance(entry, dict) else None
        if struct:
            return datetime(*struct[:6], tzinfo=timezone.utc)
    return None


def _matches_keywords(title: str, summary: str, keywords: list[str] | None) -> bool:
    if not keywords:
        return True
    haystack = f"{title} {summary}".lower()
    return any(kw.lower() in haystack for kw in keywords)


def _first_img_in_html(raw_html: str | None) -> str | None:
    if not raw_html:
        return None
    m = _IMG_TAG_RE.search(raw_html)
    if not m:
        return None
    # html.unescape: alguns feeds entregam URL com &amp; em vez de & literal
    # (ex: ?utm_a=1&amp;utm_b=2). Sem isso o image_url quebra ao baixar.
    url = html.unescape(m.group(1).strip())
    return url or None


def _from_enclosures(entry: Any) -> str | None:
    enclosures = entry.get("enclosures") or []
    if not isinstance(enclosures, list):
        return None
    for enc in enclosures:
        if not isinstance(enc, dict):
            continue
        href = (enc.get("href") or enc.get("url") or "").strip()
        if not href:
            continue
        ctype = (enc.get("type") or "").lower()
        if ctype.startswith("image/") or href.lower().endswith(
            (".jpg", ".jpeg", ".png", ".webp", ".gif")
        ):
            return html.unescape(href)
    return None


def _from_content_field(entry: Any) -> str | None:
    content = entry.get("content")
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, dict):
            return _first_img_in_html(first.get("value"))
    return None


def _from_og_image(link: str) -> str | None:
    """Última tentativa: GET na página + parse og:image. Cara, então só
    quando todos os outros caminhos falharam. Timeout curto pra não
    bloquear o pipeline em sites lentos."""
    try:
        with httpx.Client(
            timeout=_OG_FETCH_TIMEOUT,
            headers={"User-Agent": _OG_USER_AGENT},
            follow_redirects=True,
        ) as client:
            resp = client.get(link)
        if resp.status_code != 200:
            return None
        # Guard de content-type: alguns links de RSS apontam direto pra PDF/imagem
        # ou redirect retorna json. Parsear como HTML aí é silent garbage.
        ctype = (resp.headers.get("content-type") or "").lower()
        if "html" not in ctype:
            return None
        soup = BeautifulSoup(resp.text, "lxml")
        for prop in ("og:image", "og:image:secure_url", "twitter:image"):
            tag = soup.find("meta", attrs={"property": prop}) or soup.find(
                "meta", attrs={"name": prop}
            )
            if not isinstance(tag, Tag):
                continue
            content_attr = tag.get("content")
            # BS4 pode retornar AttributeValueList (multi-value); meta content
            # é sempre single-value, mas o type-check exige isinstance(str).
            if isinstance(content_attr, str):
                url = content_attr.strip()
                if url:
                    return url
    # Catch largo: lxml pode lançar ParserError, charset errors podem dar
    # UnicodeDecodeError, sites podem mandar payload bizarro. og_image é
    # best-effort — se quebrar, a matéria nasce sem foto, não dá crash.
    except Exception as exc:  # noqa: BLE001
        log.debug("og_image_fetch_failed", url=link, error=str(exc))
    return None


def _extract_image_url(entry: Any, link: str, *, scrape_og: bool) -> str | None:
    """Cadeia de fallback ordenada do mais barato pro mais caro."""
    media = entry.get("media_content") or entry.get("media_thumbnail") or []
    if isinstance(media, list) and media:
        url = (media[0].get("url") or "").strip()
        if url:
            return html.unescape(url)

    enc_url = _from_enclosures(entry)
    if enc_url:
        return enc_url

    content_url = _from_content_field(entry)
    if content_url:
        return content_url

    summary_url = _first_img_in_html(entry.get("summary") or entry.get("description"))
    if summary_url:
        return summary_url

    if scrape_og and link:
        return _from_og_image(link)

    return None


def collect_rss(source: Source) -> list[dict[str, Any]]:
    """Pega o feed da source e devolve candidatos pra raw_items (dicts)."""
    url = source.config.get("url")
    if not url:
        log.warning("rss_missing_url", source_id=source.id)
        return []

    keywords = (source.config.get("filters") or {}).get("keywords")
    # Default = scrapeia og:image. Source pode desligar via config.scrape_og=false
    # se for um feed conhecido por ser lento ou hostil a bot.
    scrape_og = bool(source.config.get("scrape_og", True))
    parsed = feedparser.parse(url)
    if parsed.bozo and not parsed.entries:
        log.warning("rss_parse_failed", source_id=source.id, error=str(parsed.bozo_exception))
        return []

    items: list[dict[str, Any]] = []
    og_scrapes = 0
    img_hits = 0
    for entry in parsed.entries[:50]:
        title = (entry.get("title") or "").strip()
        link = (entry.get("link") or "").strip()
        if not title or not link:
            continue
        summary = (entry.get("summary") or entry.get("description") or "").strip()
        if not _matches_keywords(title, summary, keywords):
            continue
        published_at = _entry_published(entry)
        ch = content_hash(link, title)
        sh = semantic_hash(title, summary)

        # Tenta cheap paths primeiro; só conta og scrape se chegou nele.
        image_url = _extract_image_url(entry, link, scrape_og=False)
        if not image_url and scrape_og:
            image_url = _from_og_image(link)
            og_scrapes += 1
        if image_url:
            img_hits += 1

        items.append(
            {
                "id": make_raw_id(source.id, ch),
                "source_id": source.id,
                "title": title[:500],
                "body": summary[:5000] if summary else None,
                "url": link,
                "image_url": image_url,
                "published_at": published_at.isoformat() if published_at else None,
                "content_hash": ch,
                "semantic_hash": sh,
            }
        )
    log.info(
        "rss_collected",
        source_id=source.id,
        count=len(items),
        img_hits=img_hits,
        og_scrapes=og_scrapes,
    )
    return items
