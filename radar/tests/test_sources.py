"""Smoke tests do Coletor — dedup hashes + RSS adapter (mock httpx)."""

from __future__ import annotations

from app.db.types import Source, SourceType
from app.sources.dedup import content_hash, make_raw_id, semantic_hash


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
