"""Hashes pra dedup — content_hash (URL+título) e semantic_hash (texto normalizado).

content_hash pega exact-match (mesma matéria republicada na mesma URL).
semantic_hash pega quase-duplicata (mesmo texto, URL diferente — comum em
agregadores).
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from urllib.parse import urlparse, urlunparse


def _normalize_url(url: str) -> str:
    """Remove query params de tracking + lowercase do host."""
    parsed = urlparse(url.strip())
    netloc = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.rstrip("/")
    return urlunparse((parsed.scheme.lower() or "https", netloc, path, "", "", ""))


def _normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def content_hash(url: str, title: str) -> str:
    raw = f"{_normalize_url(url)}|{_normalize_text(title)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def semantic_hash(title: str, body: str | None) -> str:
    """Hash do conteúdo textual normalizado — usado pra detectar republicação."""
    base = _normalize_text(title)
    if body:
        # Pega só os primeiros 500 chars normalizados — suficiente pra dedup
        # sem ficar refém de pequenas variações de rodapé.
        body_norm = _normalize_text(body)[:500]
        base = f"{base}|{body_norm}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def make_raw_id(source_id: str, content_hash_value: str) -> str:
    """ID determinístico por fonte+conteúdo — evita reinserir o mesmo item."""
    return f"{source_id}_{content_hash_value[:12]}"
