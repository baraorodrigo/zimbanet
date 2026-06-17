"""Runner do coletor — escolhe adapter por type e persiste com dedup."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.clients import supabase_client
from app.db.repositories import fetch_active_sources, update_source_run
from app.db.types import Source, SourceType
from app.logging import get_logger
from app.sources.regional import KIND_ADAPTERS as REGIONAL_ADAPTERS
from app.sources.rss import collect_rss
from app.sources.scraper import collect_scraper

log = get_logger("sources.runner")


def _adapter_for(source: Source):
    # 1) Dispatch por config["kind"] — sources com adapter dedicado (ex.:
    # portais regionais que precisam de paginação custom).
    kind = (source.config or {}).get("kind")
    if isinstance(kind, str) and kind in REGIONAL_ADAPTERS:
        return REGIONAL_ADAPTERS[kind]
    # 2) Fallback por type.
    if source.type == SourceType.rss:
        return collect_rss
    if source.type == SourceType.scraper:
        return collect_scraper
    return None


def _filter_new_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove items cujo content_hash OU url já existe em raw_items."""
    if not items:
        return []
    sb = supabase_client()
    hashes = list({it["content_hash"] for it in items})
    urls = list({it["url"] for it in items})
    by_hash = sb.table("raw_items").select("content_hash").in_("content_hash", hashes).execute()
    by_url = sb.table("raw_items").select("url").in_("url", urls).execute()
    existing_hashes = {r["content_hash"] for r in (by_hash.data or [])}
    existing_urls = {r["url"] for r in (by_url.data or [])}
    seen_urls: set[str] = set()
    fresh: list[dict[str, Any]] = []
    for it in items:
        if it["content_hash"] in existing_hashes:
            continue
        if it["url"] in existing_urls:
            continue
        if it["url"] in seen_urls:
            continue  # mesma URL repetida no batch
        seen_urls.add(it["url"])
        fresh.append(it)
    return fresh


def _flag_semantic_duplicates(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Marca is_duplicate=true e duplicate_of pra items que batem semantic_hash já existente."""
    if not items:
        return []
    sb = supabase_client()
    sem_hashes = [it["semantic_hash"] for it in items]
    resp = (
        sb.table("raw_items")
        .select("id,semantic_hash")
        .in_("semantic_hash", sem_hashes)
        .execute()
    )
    existing_by_hash = {r["semantic_hash"]: r["id"] for r in (resp.data or [])}
    seen_in_batch: dict[str, str] = {}
    for it in items:
        sh = it["semantic_hash"]
        if sh in existing_by_hash:
            it["is_duplicate"] = True
            it["duplicate_of"] = existing_by_hash[sh]
        elif sh in seen_in_batch:
            it["is_duplicate"] = True
            it["duplicate_of"] = seen_in_batch[sh]
        else:
            # Marca explicitamente como NÃO duplicado. Sem isso, num lote misto
            # (alguns dups, outros não) o PostgREST manda is_duplicate=null pros
            # não-marcados → viola o not-null e derruba o insert da fonte inteira.
            it["is_duplicate"] = False
            it["duplicate_of"] = None
            seen_in_batch[sh] = it["id"]
    return items


def _insert_items(items: list[dict[str, Any]]) -> int:
    if not items:
        return 0
    sb = supabase_client()
    resp = sb.table("raw_items").upsert(items, on_conflict="id").execute()
    return len(resp.data or [])


def run_source(source: Source) -> dict[str, Any]:
    adapter = _adapter_for(source)
    if adapter is None:
        log.info("source_no_adapter", source_id=source.id, type=source.type.value)
        return {"source_id": source.id, "skipped": True, "reason": "no_adapter"}

    try:
        candidates = adapter(source)
        fresh = _filter_new_items(candidates)
        fresh = _flag_semantic_duplicates(fresh)
        inserted = _insert_items(fresh)
    except Exception as exc:  # noqa: BLE001 — uma fonte ruim não pode derrubar o lote
        log.error("source_run_failed", source_id=source.id, error=str(exc))
        update_source_run(source.id, error=True, status=str(exc)[:180])
        return {"source_id": source.id, "error": str(exc), "inserted": 0}

    update_source_run(source.id, error=False, seen=len(candidates), status="ok")
    return {
        "source_id": source.id,
        "candidates": len(candidates),
        "fresh": len(fresh),
        "inserted": inserted,
        "duplicates": sum(1 for it in fresh if it.get("is_duplicate")),
    }


def run_all_active(limit: int | None = None) -> list[dict[str, Any]]:
    sources = fetch_active_sources(limit=limit)
    log.info("collector_run_start", count=len(sources))
    results = []
    for src in sources:
        results.append(run_source(src))
    return results


# Fonte fixa pros links que o Hermes acha na web e manda pelo MCP.
MANUAL_SOURCE_ID = "hermes_manual_web"


def submit_manual_url(
    url: str, *, note: str | None = None, run_curador: bool = True
) -> dict[str, Any]:
    """Recebe uma URL avulsa (Hermes via MCP), raspa, deduplica, insere e roda o
    Curador no item — pra ele cair direto na Pauta. NUNCA publica nada.
    """
    from app.agents.curador import score_raw_item
    from app.db.repositories import fetch_source_by_id
    from app.db.types import RawItem
    from app.sources.scraper import collect_single_url

    source = fetch_source_by_id(MANUAL_SOURCE_ID)
    if source is None:
        return {"url": url, "error": f"fonte '{MANUAL_SOURCE_ID}' não cadastrada"}

    item = collect_single_url(MANUAL_SOURCE_ID, url)
    if item is None:
        return {"url": url, "error": "não consegui raspar título/conteúdo dessa URL"}

    fresh = _filter_new_items([item])
    if not fresh:
        return {
            "url": url,
            "raw_item_id": item["id"],
            "duplicate": True,
            "scored": False,
            "reason": "essa URL/conteúdo já estava no radar",
        }

    fresh = _flag_semantic_duplicates(fresh)
    inserted = _insert_items(fresh)
    row = fresh[0]
    result: dict[str, Any] = {
        "url": url,
        "raw_item_id": row["id"],
        "inserted": inserted,
        "duplicate": bool(row.get("is_duplicate")),
        "scored": False,
    }
    if note:
        result["note"] = note[:300]

    # Roda o Curador no item recém-inserido (a não ser que seja dup semântico).
    if run_curador and not row.get("is_duplicate"):
        try:
            raw = RawItem.model_validate(row)
            output, scored = score_raw_item(raw, persist=True)
            result.update(
                {
                    "scored": True,
                    "scored_item_id": scored.id if scored else None,
                    "decision": output.decision.value,
                    "classification": output.classification,
                    "editoria": output.editoria.value,
                    "relevance_score": output.relevance_score,
                }
            )
        except Exception as exc:  # noqa: BLE001 — item já salvo; curador roda no próximo tick
            log.error("manual_url_curador_failed", url=url, error=str(exc))
            result["curador_error"] = str(exc)[:200]

    return result
