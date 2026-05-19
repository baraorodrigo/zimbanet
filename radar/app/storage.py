"""Helpers de storage — equivalente Python do src/lib/storage-images.ts.

Baixa imagem de URL externa (RSS/scraper), valida (SSRF + tipo + tamanho)
e re-hospeda no bucket `social-cards` do Supabase. Retorna URL pública
estável que não some se a fonte original tirar do ar.

Bucket compartilhado com o portal — mesmas paths convention:
  hero/<slug>/<timestamp>-<rand>.<ext>
"""

from __future__ import annotations

import ipaddress
import re
import secrets
import time
from urllib.parse import urlparse

import httpx

from app.clients import supabase_client
from app.logging import get_logger

log = get_logger("storage")

BUCKET = "social-cards"
MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024  # 15 MB — foto de jornal cabe; bomba é bloqueada
DOWNLOAD_TIMEOUT_SECONDS = 20.0
USER_AGENT = "ZIMBANET-Radar/1.0 (+https://zimbanet.com)"


def _ext_from_content_type(ctype: str | None) -> str:
    if not ctype:
        return "jpg"
    c = ctype.lower()
    if "png" in c:
        return "png"
    if "webp" in c:
        return "webp"
    if "gif" in c:
        return "gif"
    return "jpg"


def _short_id() -> str:
    return secrets.token_urlsafe(4).lower().replace("_", "").replace("-", "")[:6]


def _is_private_host(host: str) -> bool:
    """Bloqueia SSRF: localhost, loopback, RFC1918, link-local (IMDS), IPv6 privado."""
    h = host.lower()
    if h in ("localhost", "0.0.0.0", "::", "::1", "[::1]"):
        return True
    if h.endswith(".localhost") or h.endswith(".local"):
        return True
    try:
        ip = ipaddress.ip_address(h)
    except ValueError:
        # hostname — não é IP literal, segue
        return False
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_unspecified
        or ip.is_reserved
    )


def _assert_safe_url(raw: str) -> str:
    """Valida URL antes do fetch — protocolo http(s) e host não-privado."""
    try:
        u = urlparse(raw)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"URL inválida: {raw}") from exc
    if u.scheme not in ("http", "https"):
        raise ValueError(f"Protocolo não permitido: {u.scheme}")
    if not u.hostname:
        raise ValueError(f"URL sem host: {raw}")
    if _is_private_host(u.hostname):
        raise ValueError(f"Host bloqueado (privado/loopback): {u.hostname}")
    return raw


def _safe_path_segment(s: str) -> str:
    """Normaliza segmento de path — evita caracteres que quebram URL do bucket."""
    cleaned = re.sub(r"[^a-z0-9._-]+", "-", s.lower())
    return cleaned.strip("-")[:80] or "x"


def download_and_store_image(source_url: str, path_prefix: str) -> str:
    """Baixa de URL externa, valida, sobe no bucket próprio. Retorna URL pública.

    path_prefix: ex. "hero/marinha-imbituba" — final fica
    `hero/marinha-imbituba/{timestamp}-{rand}.jpg`
    """
    _assert_safe_url(source_url)

    headers = {"User-Agent": USER_AGENT}
    with httpx.Client(
        timeout=DOWNLOAD_TIMEOUT_SECONDS,
        follow_redirects=True,
        headers=headers,
    ) as client:
        res = client.get(source_url)

    if res.status_code != 200:
        raise RuntimeError(f"Falha ao baixar imagem ({res.status_code}): {source_url}")

    ctype = (res.headers.get("content-type") or "").lower()
    if not ctype.startswith("image/"):
        raise RuntimeError(f"Content-type não é imagem: {ctype!r}")

    buf = res.content
    if len(buf) > MAX_DOWNLOAD_BYTES:
        raise RuntimeError(
            f"Imagem maior que o limite ({len(buf)} > {MAX_DOWNLOAD_BYTES})"
        )

    ext = _ext_from_content_type(ctype)
    stamp = int(time.time() * 1000)
    rand = _short_id()
    safe_prefix = "/".join(_safe_path_segment(seg) for seg in path_prefix.split("/") if seg)
    path = f"{safe_prefix}/{stamp}-{rand}.{ext}"

    sb = supabase_client()
    sb.storage.from_(BUCKET).upload(
        path=path,
        file=buf,
        file_options={
            "content-type": f"image/{ext}",
            "cache-control": "31536000",
            "upsert": "false",
        },
    )

    public = sb.storage.from_(BUCKET).get_public_url(path)
    # supabase-py adiciona "?" no final em algumas versões — limpa.
    return public.rstrip("?")
