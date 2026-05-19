"""Hero Fetcher — puxa imagem da fonte original e re-hospeda no bucket próprio.

NÃO é agente LLM. É I/O puro: article → scored_item → raw_item → image_url →
download → upload Supabase → update articles.hero_image_url.

Por que existir:
- Geração automática de imagem por IA já foi testada e produz resultado fraco
  (ver feedback memory: "geracao automatica de imagem é furada").
- Caminho mais barato e mais relevante: usar a foto que a fonte (G1, NSC,
  prefeitura etc.) já publicou junto da matéria. Foto real do local, do
  personagem real, do evento real.

Limitações conhecidas:
- Se a fonte (RSS/scraper) não trouxer image_url, não tem o que fazer.
  Audit log marca `auto_fetch_hero_failed` com reason=no_image_in_source
  pra não ficar tentando de novo a cada tick.
- SSRF guard em app/storage.py bloqueia URLs privadas/loopback. URLs
  públicas legítimas das fontes passam normal.
"""

from __future__ import annotations

from typing import Any

from app.clients import supabase_client
from app.db.repositories import insert_audit_log
from app.db.types import Article, AuditLogEntry
from app.logging import get_logger
from app.storage import download_and_store_image

log = get_logger("hero_fetcher")


def _audit_fail(article_id: str, reason: str, metadata: dict[str, Any] | None = None) -> None:
    meta = {"reason": reason, **(metadata or {})}
    insert_audit_log(
        AuditLogEntry(
            entity_type="article",
            entity_id=article_id,
            action="auto_fetch_hero_failed",
            actor="scheduler",
            agent="hero_fetcher",
            metadata=meta,
        )
    )


def fetch_hero_for_article(article: Article, *, persist: bool = True) -> bool:
    """Puxa hero da fonte original e atualiza o artigo. Retorna True se conseguiu.

    Cadeia: articles.scored_item_id → scored_items.raw_item_id → raw_items.image_url.
    Sem scored_item ou sem image_url → audit log de falha e retorna False
    (assim o filtro de pendentes em fetch_articles_without_hero não tenta de novo).
    """
    if not article.scored_item_id:
        log.warning("hero_fetcher_no_scored_item", article_id=article.id)
        if persist:
            _audit_fail(article.id, "no_scored_item")
        return False

    sb = supabase_client()

    scored_resp = (
        sb.table("scored_items")
        .select("raw_item_id")
        .eq("id", str(article.scored_item_id))
        .limit(1)
        .execute()
    )
    if not scored_resp.data:
        log.warning(
            "hero_fetcher_scored_missing",
            article_id=article.id,
            scored_item_id=article.scored_item_id,
        )
        if persist:
            _audit_fail(article.id, "scored_item_missing")
        return False

    raw_item_id = scored_resp.data[0].get("raw_item_id")
    if not raw_item_id:
        if persist:
            _audit_fail(article.id, "raw_item_id_missing")
        return False

    raw_resp = (
        sb.table("raw_items")
        .select("image_url, url")
        .eq("id", str(raw_item_id))
        .limit(1)
        .execute()
    )
    if not raw_resp.data:
        log.warning(
            "hero_fetcher_raw_missing",
            article_id=article.id,
            raw_item_id=raw_item_id,
        )
        if persist:
            _audit_fail(article.id, "raw_item_missing", {"raw_item_id": raw_item_id})
        return False

    raw_row = raw_resp.data[0]
    source_image = raw_row.get("image_url")
    source_url = raw_row.get("url")

    if not source_image:
        log.info(
            "hero_fetcher_no_image_in_source",
            article_id=article.id,
            raw_item_id=raw_item_id,
        )
        if persist:
            _audit_fail(
                article.id,
                "no_image_in_source",
                {"raw_item_id": raw_item_id, "source_url": source_url},
            )
        return False

    try:
        hosted_url = download_and_store_image(
            source_image,
            path_prefix=f"hero/{article.slug}",
        )
    except Exception as exc:  # noqa: BLE001
        log.exception(
            "hero_fetcher_download_failed",
            article_id=article.id,
            source_image=source_image,
            error=str(exc),
        )
        if persist:
            _audit_fail(
                article.id,
                "download_failed",
                {
                    "raw_item_id": raw_item_id,
                    "source_image": source_image,
                    "error": str(exc)[:300],
                },
            )
        return False

    if persist:
        sb.table("articles").update({"hero_image_url": hosted_url}).eq(
            "id", str(article.id)
        ).execute()
        insert_audit_log(
            AuditLogEntry(
                entity_type="article",
                entity_id=str(article.id),
                action="auto_fetch_hero",
                actor="scheduler",
                agent="hero_fetcher",
                metadata={
                    "raw_item_id": raw_item_id,
                    "source_image": source_image,
                    "hosted_url": hosted_url,
                },
            )
        )

    log.info(
        "hero_fetcher_done",
        article_id=article.id,
        slug=article.slug,
        hosted_url=hosted_url,
    )
    return True
