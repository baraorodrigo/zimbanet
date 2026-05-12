"""Adapters dedicados pros portais regionais de Imbituba.

Diferente do `scraper.py` genérico (que usa um único seletor de link),
esses adapters tratam as particularidades de cada portal:

- **Portal Ahora** tem arquivo diário em `/AAAA/MM/DD/` — lista direta dos
  posts daquele dia. Markup do Elementor, body em
  `[data-widget_type="theme-post-content.default"]`.
- **Portal Click Sul** não tem arquivo nem RSS — varremos home + várias
  páginas de categoria, filtramos por shape de URL (slug com 2+ hífens)
  e datamos pelo meta `article:published_time`.

Tanto o backfill (`scripts/backfill_week.py`) quanto o runner agendado
(`app/sources/runner.py`) entram aqui — backfill com janela longa,
runner com janela curta (default 36h).

Despacho pelo runner: `source.config["kind"]` precisa ser
"regional_ahora" ou "regional_clicksul".
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag

from app.db.types import Source
from app.logging import get_logger
from app.sources.dedup import content_hash, make_raw_id, semantic_hash

log = get_logger("sources.regional")

USER_AGENT = "ZIMBANET-Radar/0.1 (+https://zimbanet.com.br)"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)
SLEEP_BETWEEN_REQUESTS = 0.3  # gentil com os portais

AHORA_SOURCE_ID = "portal_ahora_imbituba"
CLICKSUL_SOURCE_ID = "portal_clicksul_imbituba"
AHORA_BASE = "https://portalahora.com.br"
CLICKSUL_BASE = "https://portalclicksul.com.br"

CLICKSUL_LIST_PAGES = [
    "/",
    "/cidades/imbituba",
    "/cidades/garopaba",
    "/cidades/laguna",
    "/cidades/tubarao",
    "/cidades/paulo-lopes",
    "/Noticías-de-segurança-na-Região-Sul",
    "/politica",
    "/esporte",
    "/clima",
    "/geral",
    "/economia",
]

# Limites por uso. Backfill passa override; runner recorrente usa default.
RECURRING_WINDOW_HOURS = 36
RECURRING_MAX_ITEMS = 15


@dataclass
class Article:
    url: str
    title: str
    body: str | None
    image_url: str | None
    published_at: datetime | None


# ============================================================================
# HTTP helpers
# ============================================================================
def make_client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9"},
        timeout=TIMEOUT,
        follow_redirects=True,
    )


def fetch(client: httpx.Client, url: str) -> str | None:
    try:
        resp = client.get(url)
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        body = resp.text or ""
        # Portal Ahora devolve 404 nas páginas de arquivo, mas com o HTML
        # real no body. Aceitamos qualquer resposta com HTML substancial.
        if resp.status_code >= 500 or (resp.status_code >= 400 and len(body) < 2000):
            log.warning("fetch_http_error", url=url, status=resp.status_code)
            return None
        return body
    except httpx.HTTPError as exc:
        log.warning("fetch_failed", url=url, error=str(exc))
        return None


# ============================================================================
# Parsers comuns
# ============================================================================
def parse_iso(s: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def parse_loose_dt(s: str) -> datetime | None:
    # Click Sul manda "2026-04-29 14:04:55" (sem T, sem TZ)
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?", s)
    if not m:
        return None
    y, mo, d, h, mi = (int(g) for g in m.groups()[:5])
    sec = int(m.group(6) or 0)
    return datetime(y, mo, d, h, mi, sec, tzinfo=timezone.utc)


def extract_jsonld_date(soup: BeautifulSoup) -> datetime | None:
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        if not isinstance(tag, Tag):
            continue
        raw = tag.string or tag.get_text() or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        candidates = data if isinstance(data, list) else [data]
        flat: list[dict[str, Any]] = []
        for c in candidates:
            if not isinstance(c, dict):
                continue
            graph = c.get("@graph")
            if isinstance(graph, list):
                flat.extend(g for g in graph if isinstance(g, dict))
            else:
                flat.append(c)
        for entity in flat:
            for key in ("datePublished", "dateCreated", "uploadDate"):
                val = entity.get(key)
                if isinstance(val, str) and val:
                    try:
                        return datetime.fromisoformat(val.replace("Z", "+00:00"))
                    except ValueError:
                        continue
    return None


def extract_meta_date(soup: BeautifulSoup) -> datetime | None:
    for prop in ("article:published_time", "og:article:published_time"):
        tag = soup.find("meta", attrs={"property": prop})
        if not isinstance(tag, Tag):
            tag = soup.find("meta", attrs={"name": prop})
        if not isinstance(tag, Tag):
            continue
        content = tag.get("content")
        if not isinstance(content, str) or not content.strip():
            continue
        for parser in (parse_iso, parse_loose_dt):
            dt = parser(content.strip())
            if dt:
                return dt
    return None


def extract_og_image(soup: BeautifulSoup) -> str | None:
    for prop in ("og:image", "og:image:secure_url", "twitter:image"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find(
            "meta", attrs={"name": prop}
        )
        if isinstance(tag, Tag):
            content = tag.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
    return None


def extract_og_title(soup: BeautifulSoup) -> str | None:
    tag = soup.find("meta", attrs={"property": "og:title"})
    if isinstance(tag, Tag):
        content = tag.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return None


# ============================================================================
# Portal Ahora
# ============================================================================
_AHORA_POST_RE = re.compile(r"^https://portalahora\.com\.br/noticias/[^/]+/?$")


def _ahora_collect_day(client: httpx.Client, day: datetime) -> list[str]:
    url = f"{AHORA_BASE}/{day.year:04d}/{day.month:02d}/{day.day:02d}/"
    html = fetch(client, url)
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    urls: set[str] = set()
    for a in soup.find_all("a", href=True):
        if not isinstance(a, Tag):
            continue
        href = a.get("href")
        if not isinstance(href, str):
            continue
        absolute = urljoin(AHORA_BASE, href)
        if _AHORA_POST_RE.match(absolute):
            urls.add(absolute.rstrip("/") + "/")
    log.info("ahora_day_collected", day=day.date().isoformat(), count=len(urls))
    return sorted(urls)


def _parse_ahora_article(html: str, url: str) -> Article | None:
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.select_one("h1.elementor-heading-title") or soup.find("h1")
    title = (title_tag.get_text(strip=True) if isinstance(title_tag, Tag) else "") or (
        extract_og_title(soup) or ""
    )
    if not title:
        return None
    body_tag = soup.select_one(
        '[data-widget_type="theme-post-content.default"] .elementor-widget-container'
    )
    body: str | None = None
    if isinstance(body_tag, Tag):
        for junk in body_tag.find_all(["script", "style", "iframe", "form"]):
            junk.decompose()
        body = body_tag.get_text("\n", strip=True)[:8000] or None
    published_at = extract_jsonld_date(soup) or extract_meta_date(soup)
    image_url = extract_og_image(soup)
    return Article(
        url=url, title=title[:500], body=body, image_url=image_url, published_at=published_at
    )


def harvest_ahora(
    client: httpx.Client, since: datetime, until: datetime, *, max_items: int | None = None
) -> list[Article]:
    log.info("ahora_harvest_start", since=since.isoformat(), until=until.isoformat())
    article_urls: set[str] = set()
    day = since
    while day.date() <= until.date():
        for u in _ahora_collect_day(client, day):
            article_urls.add(u)
        day += timedelta(days=1)
    log.info("ahora_urls_collected", count=len(article_urls))
    out: list[Article] = []
    for url in sorted(article_urls):
        html = fetch(client, url)
        if not html:
            continue
        article = _parse_ahora_article(html, url)
        if not article:
            continue
        out.append(article)
        if max_items is not None and len(out) >= max_items:
            log.info("ahora_max_items_hit", limit=max_items)
            break
    return out


# ============================================================================
# Portal Click Sul
# ============================================================================
_CLICKSUL_CATEGORY_PATHS = {
    "/cidades",
    "/cidades/imbituba",
    "/cidades/garopaba",
    "/cidades/laguna",
    "/cidades/tubarao",
    "/cidades/paulo-lopes",
    "/cidades/imarui",
    "/cidades/pescaria-brava",
    "/cidades/capivari-de-baixo",
    "/cidades/meio-ambiente",
    "/Noticías-de-segurança-na-Região-Sul",
    "/politica",
    "/esporte",
    "/clima",
    "/geral",
    "/economia",
    "/saude",
    "/brasil",
    "/mundo",
    "/turismo",
    "/educacao",
}


def _is_clicksul_article_url(href: str) -> bool:
    if not href.startswith(CLICKSUL_BASE):
        return False
    path = href[len(CLICKSUL_BASE) :]
    if not path.startswith("/") or path == "/":
        return False
    path = path.split("?", 1)[0].split("#", 1)[0].rstrip("/")
    if not path:
        return False
    if "/" in path[1:]:
        return False
    if path in _CLICKSUL_CATEGORY_PATHS:
        return False
    slug = path.lstrip("/")
    if slug.count("-") < 2:
        return False
    return True


def _clicksul_collect_links(client: httpx.Client) -> set[str]:
    urls: set[str] = set()
    for path in CLICKSUL_LIST_PAGES:
        html = fetch(client, urljoin(CLICKSUL_BASE, path))
        if not html:
            continue
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            if not isinstance(a, Tag):
                continue
            href = a.get("href")
            if not isinstance(href, str):
                continue
            absolute = urljoin(CLICKSUL_BASE, href)
            if _is_clicksul_article_url(absolute):
                urls.add(absolute)
        log.info("clicksul_list_collected", path=path, running_total=len(urls))
    return urls


def _parse_clicksul_article(html: str, url: str) -> Article | None:
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.select_one("h1.post-title") or soup.find("h1")
    title = (title_tag.get_text(strip=True) if isinstance(title_tag, Tag) else "") or (
        extract_og_title(soup) or ""
    )
    if not title:
        return None
    body_tag = soup.select_one(".post-content")
    body: str | None = None
    if isinstance(body_tag, Tag):
        for junk in body_tag.find_all(["script", "style", "iframe", "form"]):
            junk.decompose()
        body = body_tag.get_text("\n", strip=True)[:8000] or None
    published_at = extract_meta_date(soup) or extract_jsonld_date(soup)
    image_url = extract_og_image(soup)
    return Article(
        url=url, title=title[:500], body=body, image_url=image_url, published_at=published_at
    )


def harvest_clicksul(
    client: httpx.Client, since: datetime, until: datetime, *, max_items: int | None = None
) -> list[Article]:
    log.info("clicksul_harvest_start", since=since.isoformat(), until=until.isoformat())
    candidate_urls = _clicksul_collect_links(client)
    log.info("clicksul_candidates", count=len(candidate_urls))
    out: list[Article] = []
    for url in sorted(candidate_urls):
        html = fetch(client, url)
        if not html:
            continue
        article = _parse_clicksul_article(html, url)
        if not article:
            continue
        if article.published_at is None:
            continue
        if not (since <= article.published_at <= until + timedelta(days=1)):
            continue
        out.append(article)
        if max_items is not None and len(out) >= max_items:
            log.info("clicksul_max_items_hit", limit=max_items)
            break
    return out


# ============================================================================
# Adapters de runner — usados por app.sources.runner.run_source
# ============================================================================
def _articles_to_items(source_id: str, articles: list[Article]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for a in articles:
        ch = content_hash(a.url, a.title)
        sh = semantic_hash(a.title, a.body)
        out.append(
            {
                "id": make_raw_id(source_id, ch),
                "source_id": source_id,
                "title": a.title,
                "body": a.body,
                "url": a.url,
                "image_url": a.image_url,
                "published_at": a.published_at.isoformat() if a.published_at else None,
                "content_hash": ch,
                "semantic_hash": sh,
            }
        )
    return out


def _window_from_config(source: Source) -> tuple[datetime, datetime, int]:
    """Lê janela (horas) e max_items do config, com defaults pra uso recorrente."""
    cfg = source.config or {}
    hours = int(cfg.get("window_hours", RECURRING_WINDOW_HOURS))
    max_items = int(cfg.get("max_items_per_run", RECURRING_MAX_ITEMS))
    until = datetime.now(timezone.utc)
    since = until - timedelta(hours=hours)
    return since, until, max_items


def collect_regional_ahora(source: Source) -> list[dict[str, Any]]:
    since, until, max_items = _window_from_config(source)
    with make_client() as client:
        articles = harvest_ahora(client, since, until, max_items=max_items)
    log.info(
        "regional_ahora_done",
        source_id=source.id,
        window_hours=int((until - since).total_seconds() // 3600),
        articles=len(articles),
    )
    return _articles_to_items(source.id, articles)


def collect_regional_clicksul(source: Source) -> list[dict[str, Any]]:
    since, until, max_items = _window_from_config(source)
    with make_client() as client:
        articles = harvest_clicksul(client, since, until, max_items=max_items)
    log.info(
        "regional_clicksul_done",
        source_id=source.id,
        window_hours=int((until - since).total_seconds() // 3600),
        articles=len(articles),
    )
    return _articles_to_items(source.id, articles)


# Despacho pelo runner: config["kind"] → função
KIND_ADAPTERS = {
    "regional_ahora": collect_regional_ahora,
    "regional_clicksul": collect_regional_clicksul,
}
