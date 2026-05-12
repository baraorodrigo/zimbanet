"""HTTP client pro /api/push/breaking do portal.

Disparado em auto-publish (scheduler) quando o article promovido tem
is_breaking=true. Stateless: portal puxa o conteúdo direto do Supabase pra
evitar drift.
"""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.logging import get_logger

log = get_logger("push.client")


def notify_breaking_published(article_id: str, *, timeout_s: float = 15.0) -> bool:
    """POST {portal_base_url}/api/push/breaking com X-Internal-Token.

    Retorna True se o envio (sent + skipped sem erro) foi aceito; False em
    qualquer falha. Não levanta exceção — esse caminho roda em scheduler tick
    e não pode derrubar a publicação.
    """
    settings = get_settings()
    if not settings.push_enabled:
        log.debug("push_disabled")
        return False
    if not settings.internal_push_token:
        log.warning("push_token_missing")
        return False

    url = f"{settings.portal_base_url.rstrip('/')}/api/push/breaking"
    headers = {
        "x-internal-token": settings.internal_push_token,
        "content-type": "application/json",
    }
    body = {"article_id": str(article_id)}

    try:
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(url, headers=headers, json=body)
        if resp.status_code >= 400:
            log.warning(
                "push_breaking_failed",
                status=resp.status_code,
                body=resp.text[:200],
                article_id=str(article_id),
            )
            return False
        data = resp.json() if resp.content else {}
        log.info(
            "push_breaking_sent",
            article_id=str(article_id),
            sent=data.get("sent", 0),
            pruned=data.get("pruned", 0),
            skipped=data.get("skipped"),
        )
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("push_breaking_exception", error=str(exc), article_id=str(article_id))
        return False
