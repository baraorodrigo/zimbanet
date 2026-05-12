"""Unit tests pro detector de vídeo em sources/video.py."""

from __future__ import annotations

from bs4 import BeautifulSoup

from app.sources.video import extract_video_url


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def test_returns_none_when_no_video() -> None:
    html = "<html><body><p>matéria só de texto</p></body></html>"
    assert extract_video_url(_soup(html)) is None


def test_detects_youtube_iframe() -> None:
    html = """
    <html><body>
      <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe>
    </body></html>
    """
    assert extract_video_url(_soup(html)) == "https://www.youtube.com/embed/dQw4w9WgXcQ"


def test_detects_youtube_nocookie_iframe() -> None:
    html = '<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>'
    assert extract_video_url(_soup(html)) == "https://www.youtube-nocookie.com/embed/abc123"


def test_detects_instagram_reel_iframe() -> None:
    html = '<iframe src="https://www.instagram.com/reel/Cabc123/embed"></iframe>'
    assert extract_video_url(_soup(html)) == "https://www.instagram.com/reel/Cabc123/embed"


def test_detects_tiktok_iframe() -> None:
    html = '<iframe src="https://www.tiktok.com/embed/v2/7234567890"></iframe>'
    assert extract_video_url(_soup(html)) == "https://www.tiktok.com/embed/v2/7234567890"


def test_detects_lazy_iframe_via_data_src() -> None:
    """WordPress às vezes lazy-loada via data-src/data-lazy-src."""
    html = '<iframe data-lazy-src="https://www.youtube.com/embed/xyz"></iframe>'
    assert extract_video_url(_soup(html)) == "https://www.youtube.com/embed/xyz"


def test_detects_og_video_meta() -> None:
    html = """
    <html><head>
      <meta property="og:video" content="https://www.youtube.com/watch?v=foo">
    </head></html>
    """
    assert extract_video_url(_soup(html)) == "https://www.youtube.com/watch?v=foo"


def test_detects_twitter_player_meta() -> None:
    html = """
    <html><head>
      <meta name="twitter:player" content="https://www.tiktok.com/embed/v2/9999">
    </head></html>
    """
    assert extract_video_url(_soup(html)) == "https://www.tiktok.com/embed/v2/9999"


def test_detects_bare_youtube_link_in_body() -> None:
    """Click Sul faz isso: cola o link cru do YT no corpo da matéria."""
    html = """
    <html><body>
      <p>Veja o vídeo: <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">aqui</a></p>
    </body></html>
    """
    assert extract_video_url(_soup(html)) == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_detects_youtu_be_short_link() -> None:
    html = '<a href="https://youtu.be/dQw4w9WgXcQ">video</a>'
    assert extract_video_url(_soup(html)) == "https://youtu.be/dQw4w9WgXcQ"


def test_detects_instagram_post_link() -> None:
    html = '<a href="https://www.instagram.com/p/Cabc123/">post</a>'
    assert extract_video_url(_soup(html)) == "https://www.instagram.com/p/Cabc123/"


def test_ignores_unknown_host_iframe() -> None:
    """Iframe genérico (mapa, comentários etc) não vira vídeo."""
    html = '<iframe src="https://www.google.com/maps/embed?pb=..."></iframe>'
    assert extract_video_url(_soup(html)) is None


def test_ignores_unrelated_anchor() -> None:
    html = '<a href="https://example.com/noticia/foo">link normal</a>'
    assert extract_video_url(_soup(html)) is None


def test_meta_wins_over_iframe_when_both_present() -> None:
    """Meta vem primeiro na cadeia (mais explícito que iframe perdido)."""
    html = """
    <html>
      <head>
        <meta property="og:video" content="https://www.youtube.com/watch?v=META">
      </head>
      <body>
        <iframe src="https://www.youtube.com/embed/FRAME"></iframe>
      </body>
    </html>
    """
    assert extract_video_url(_soup(html)) == "https://www.youtube.com/watch?v=META"
