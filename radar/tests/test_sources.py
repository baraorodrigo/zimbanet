"""Smoke tests do Coletor — dedup hashes + RSS adapter (mock httpx)."""

from __future__ import annotations

from zoneinfo import ZoneInfo

from app.db.types import Source, SourceType
from app.sources.dedup import content_hash, make_raw_id, semantic_hash
from app.sources.regional import extract_jsonld_date, parse_br_dt, parse_iso, parse_loose_dt

_SP = ZoneInfo("America/Sao_Paulo")


def test_parse_iso_naive_is_brt_not_utc() -> None:
    # ClickSul manda "2026-06-27 00:30:00" (sem TZ). Sem fuso seria gravado como
    # UTC e a madrugada cairia no dia 26 em São Paulo. Deve ficar dia 27.
    dt = parse_iso("2026-06-27 00:30:00")
    assert dt is not None
    sp = dt.astimezone(_SP)
    assert (sp.year, sp.month, sp.day, sp.hour, sp.minute) == (2026, 6, 27, 0, 30)


def test_parse_iso_keeps_explicit_offset() -> None:
    # TZ explícita não é tocada (continua correta).
    dt = parse_iso("2026-06-27T00:30:00-03:00")
    assert dt is not None
    assert dt.astimezone(_SP).day == 27


def test_parse_loose_dt_is_brt() -> None:
    dt = parse_loose_dt("2026-06-27 00:30:00")
    assert dt is not None and dt.astimezone(_SP).day == 27


def test_parse_br_dt_is_brt() -> None:
    dt = parse_br_dt("27/06/2026 00:30")
    assert dt is not None and dt.astimezone(_SP).day == 27


def test_extract_jsonld_date_naive_is_brt() -> None:
    from bs4 import BeautifulSoup

    html = '<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-06-27T00:30:00"}</script>'
    dt = extract_jsonld_date(BeautifulSoup(html, "html.parser"))
    assert dt is not None and dt.astimezone(_SP).day == 27


def test_content_hash_stable_under_normalization() -> None:
    h1 = content_hash("https://WWW.Example.com/foo/", "Título Exemplo")
    h2 = content_hash("https://example.com/foo", "  título  exemplo  ")
    assert h1 == h2


def test_content_hash_changes_on_different_url() -> None:
    h1 = content_hash("https://example.com/a", "Título")
    h2 = content_hash("https://example.com/b", "Título")
    assert h1 != h2


def test_semantic_hash_stable_with_accents() -> None:
    h1 = semantic_hash("Sessão da Câmara", "discussão sobre orçamento")
    h2 = semantic_hash("sessao da camara", "Discussao sobre orcamento")
    assert h1 == h2


def test_make_raw_id_format() -> None:
    ch = content_hash("https://example.com/x", "T")
    rid = make_raw_id("nd_mais_imbituba", ch)
    assert rid.startswith("nd_mais_imbituba_")
    assert len(rid) == len("nd_mais_imbituba_") + 12


def test_rss_adapter_filters_by_keywords() -> None:
    """Garante que filters.keywords filtra entries — mocka feedparser."""
    from unittest.mock import MagicMock, patch

    src = Source(
        id="t",
        name="Teste",
        type=SourceType.rss,
        config={"url": "https://example.com/feed", "filters": {"keywords": ["imbituba"]}},
        city="imbituba",
    )

    fake_parsed = MagicMock()
    fake_parsed.bozo = 0
    fake_parsed.entries = [
        {
            "title": "Imbituba ganha nova creche",
            "link": "https://x.com/a",
            "summary": "obra inaugurada hoje",
            "published_parsed": (2026, 5, 9, 12, 0, 0, 0, 0, 0),
        },
        {
            "title": "São Paulo lança programa",
            "link": "https://x.com/b",
            "summary": "longe daqui",
            "published_parsed": (2026, 5, 9, 12, 0, 0, 0, 0, 0),
        },
    ]
    with patch("app.sources.rss.feedparser.parse", return_value=fake_parsed):
        from app.sources.rss import collect_rss

        items = collect_rss(src)

    assert len(items) == 1
    assert items[0]["source_id"] == "t"
    assert "Imbituba" in items[0]["title"]


def test_rsc_url_filter_accepts_article_and_rejects_sections() -> None:
    from app.sources.regional import _is_rsc_article_url

    assert _is_rsc_article_url(
        "https://rscportal.com.br/seguranca/homem-sofre-parada-cardiorrespiratoria.15476595"
    )
    assert not _is_rsc_article_url("https://rscportal.com.br/seguranca")
    assert not _is_rsc_article_url("https://rscportal.com.br/radio_89_3_fm_a_mais_ouvida")
    assert not _is_rsc_article_url("https://rscportal.com.br/seguranca/foo/bar.123")


def test_rsc_parser_extracts_visible_date_title_and_body() -> None:
    from app.sources.regional import _parse_rsc_article

    html = """
    <html>
      <head>
        <meta property="og:title" content="Homem é socorrido pelo SAMU em Imbituba" />
        <meta property="og:image" content="https://img.exemplo/rsc.jpg" />
      </head>
      <body>
        <div class="entry-header">
          <h2 class="post-title lg">Homem é socorrido pelo SAMU em Imbituba</h2>
          <ul class="post-meta-info">
            <li>23/06/2026 09:39</li>
          </ul>
        </div>
        <div class="entry-content">
          <h3 class="class-resumo">Resumo curto</h3>
          <p>Primeiro parágrafo com contexto local.</p>
          <p>Segundo parágrafo com atualização do atendimento.</p>
        </div>
      </body>
    </html>
    """

    article = _parse_rsc_article(
        html,
        "https://rscportal.com.br/seguranca/homem-e-socorrido-pelo-samu-em-imbituba.15476595",
    )

    assert article is not None
    assert article.title == "Homem é socorrido pelo SAMU em Imbituba"
    assert article.image_url == "https://img.exemplo/rsc.jpg"
    assert article.published_at is not None
    assert article.published_at.year == 2026
    assert article.published_at.month == 6
    assert article.published_at.day == 23
    assert article.body is not None
    assert "Resumo curto" in article.body
    assert "Primeiro parágrafo com contexto local." in article.body
