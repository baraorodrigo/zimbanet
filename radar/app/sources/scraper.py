"""Adapter HTML scraper — httpx + BeautifulSoup, baseado em selectors do config.

Imagem do item: igual ao `rss.py`, cadeia de fallbacks. Quando a fonte expõe
um `<img>` específico mais confiável que o og:image (ex: thumbnail grande
da categoria), o admin configura `selector_image` no config da fonte; senão
caímos no og:image padrão. Sem isso o scraper genérico nascia sem foto e
toda matéria entrava na Pauta sem thumb.
"""

from __future__ import annotations

import html
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag

from app.db.types import Source
from app.logging import get_logger
from app.sources.dedup import content_hash, make_raw_id, semantic_hash

log = get_logger("sources.scraper")

USER_AGENT = "ZIMBANET-Radar/0.1 (+https://zimbanet.com.br)"
TIMEOUT = httpx.Timeout(15.0, connect=10.0)
MAX_ARTICLES_PER_RUN = 10


def _fetch(url: str) -> str | None:
    try:
        resp = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT, follow_redirects=True)
        if resp.status_code >= 400:
            log.warning("scraper_http_error", url=url, status=resp.status_code)
            return None
        return resp.text
    except httpx.HTTPError as exc:
        log.warning("scraper_http_failed", url=url, error=str(exc))
        return None


def _from_selector(soup: BeautifulSoup, selector: str, article_url: str) -> str | None:
    """Tenta extrair imagem do selector configurado.

    Aceita `<img>` direto, ou qualquer elemento com atributo `src`/`data-src`/
    `srcset`. Resolve URL relativa contra a página do artigo.
    """
    el = soup.select_one(selector)
    if not isinstance(el, Tag):
        return None
    # Preferir src; depois data-src (lazy load); depois primeiro item de srcset
    for attr in ("src", "data-src", "data-lazy-src"):
        val = el.get(attr)
        if isinstance(val, str) and val.strip():
            return urljoin(article_url, html.unescape(val.strip()))
    srcset = el.get("srcset")
    if isinstance(srcset, str) and srcset.strip():
        # srcset = "url1 1x, url2 2x" — pega o primeiro
        first = srcset.split(",", 1)[0].strip().split(" ", 1)[0]
        if first:
            return urljoin(article_url, html.unescape(first))
    return None


def _from_meta_image(soup: BeautifulSoup) -> str | None:
    """Cadeia og:image / twitter:image — idêntico ao rss._from_og_image,
    mas o HTML já está baixado então não tem custo extra."""
    for prop in ("og:image", "og:image:secure_url", "twitter:image"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find(
            "meta", attrs={"name": prop}
        )
        if not isinstance(tag, Tag):
            continue
        content = tag.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return None


def _extract_image(soup: BeautifulSoup, article_url: str, sel_image: str | None) -> str | None:
    if sel_image:
        img = _from_selector(soup, sel_image, article_url)
        if img:
            return img
    return _from_meta_image(soup)


def collect_scraper(source: Source) -> list[dict[str, Any]]:
    cfg = source.config
    list_url = cfg.get("url")
    sel_link = cfg.get("selector_link")
    sel_title = cfg.get("selector_title")
    sel_body = cfg.get("selector_body")
    sel_image = cfg.get("selector_image")
    if not (list_url and sel_link):
        log.info("scraper_skipped_no_selectors", source_id=source.id)
        return []

    listing_html = _fetch(list_url)
    if not listing_html:
        return []

    soup = BeautifulSoup(listing_html, "lxml")
    link_tags = soup.select(sel_link)[:MAX_ARTICLES_PER_RUN]
    if not link_tags:
        log.info("scraper_no_links", source_id=source.id, selector=sel_link)
        return []

    items: list[dict[str, Any]] = []
    img_hits = 0
    for tag in link_tags:
        href = tag.get("href")
        if not href:
            continue
        article_url = urljoin(list_url, href)
        article_html = _fetch(article_url)
        if not article_html:
            continue
        a_soup = BeautifulSoup(article_html, "lxml")

        title = ""
        if sel_title:
            t_el = a_soup.select_one(sel_title)
            if t_el:
                title = t_el.get_text(strip=True)
        if not title:
            t_el = a_soup.find(["h1", "h2"])
            if t_el:
                title = t_el.get_text(strip=True)
        if not title:
            continue

        body: str | None = None
        if sel_body:
            b_el = a_soup.select_one(sel_body)
            if b_el:
                body = b_el.get_text("\n", strip=True)[:8000]

        image_url = _extract_image(a_soup, article_url, sel_image)
        if image_url:
            img_hits += 1

        ch = content_hash(article_url, title)
        sh = semantic_hash(title, body)
        items.append(
            {
                "id": make_raw_id(source.id, ch),
                "source_id": source.id,
                "title": title[:500],
                "body": body,
                "url": article_url,
                "image_url": image_url,
                "content_hash": ch,
                "semantic_hash": sh,
            }
        )

    log.info("scraper_collected", source_id=source.id, count=len(items), img_hits=img_hits)
    return items
