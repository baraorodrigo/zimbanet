"""Endpoints de pipeline — encadeiam múltiplos agentes num único call.

Útil pro portal: ao admin clicar 'Redigir com AI', um POST só já gera draft.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.agents.curador import score_raw_item
from app.agents.distribuidor import distribute_article
from app.agents.investigador import enrich_scored_item
from app.agents.redator import draft_article
from app.agents.visual import visualize_article
from app.clients import supabase_client
from app.db.repositories import (
    fetch_approved_unenriched,
    fetch_article,
    fetch_enriched_no_article,
    fetch_unscored_raw_items,
)
from app.db.types import EnrichedItem, ScoredItem
from app.logging import get_logger
from app.sources.runner import run_all_active

router = APIRouter()
log = get_logger("api.pipeline")


@router.post("/draft/{scored_item_id}")
async def pipeline_draft(scored_item_id: str) -> dict[str, Any]:
    """Investigador → Redator no scored_item informado. Devolve article criado."""
    sb = supabase_client()
    scored_resp = sb.table("scored_items").select("*").eq("id", scored_item_id).limit(1).execute()
    scored_rows = scored_resp.data or []
    if not scored_rows:
        raise HTTPException(status_code=404, detail="scored_item não encontrado")
    scored = ScoredItem.model_validate(scored_rows[0])

    # Reusa enriched existente se houver — economiza Sonnet.
    existing = (
        sb.table("enriched_items").select("*").eq("scored_item_id", scored.id).limit(1).execute()
    )
    enriched_rows = existing.data or []
    if enriched_rows:
        enriched = EnrichedItem.model_validate(enriched_rows[0])
        log.info("pipeline_reuse_enriched", scored_item_id=scored.id)
    else:
        _, enriched_obj = enrich_scored_item(scored, persist=True)
        if enriched_obj is None:
            raise HTTPException(status_code=500, detail="enriquecimento falhou")
        enriched = enriched_obj

    # Reusa article existente se já houver pra esse enriched
    art_existing = (
        sb.table("articles").select("*").eq("enriched_item_id", enriched.id).limit(1).execute()
    )
    if art_existing.data:
        from app.db.types import Article

        article = Article.model_validate(art_existing.data[0])
        log.info("pipeline_reuse_article", article_id=article.id)
        return {
            "scored_item_id": scored.id,
            "enriched_item_id": enriched.id,
            "article_id": article.id,
            "slug": article.slug,
            "title": article.title,
            "reused": True,
        }

    _, article = draft_article(scored=scored, enriched=enriched, persist=True)
    if article is None:
        raise HTTPException(status_code=500, detail="redação falhou")

    return {
        "scored_item_id": scored.id,
        "enriched_item_id": enriched.id,
        "article_id": article.id,
        "slug": article.slug,
        "title": article.title,
        "reused": False,
    }


@router.post("/run-all")
async def pipeline_run_all(
    skip_collect: bool = Query(default=False),
    curador_limit: int = Query(default=20, ge=1, le=100),
    investigador_limit: int = Query(default=5, ge=1, le=20),
    redator_limit: int = Query(default=5, ge=1, le=20),
) -> dict[str, Any]:
    """Roda Coletor → Curador → Investigador → Redator em sequência.

    Cap por etapa pra não estourar custo de Sonnet. Cada etapa é independente
    — se Curador falhar num item, segue pros próximos. Não roda Visual nem
    Distribuidor; isso só após admin aprovar manualmente.
    """
    summary: dict[str, Any] = {}

    # 1. Coleta
    if not skip_collect:
        collect_results = run_all_active()
        summary["collect"] = {
            "sources_run": len(collect_results),
            "total_inserted": sum(r.get("inserted", 0) for r in collect_results),
        }
    else:
        summary["collect"] = {"skipped": True}

    # 2. Curador
    raw_pending = fetch_unscored_raw_items(limit=curador_limit)
    cur_processed = 0
    cur_failed = 0
    for raw in raw_pending:
        try:
            score_raw_item(raw, persist=True)
            cur_processed += 1
        except Exception as exc:  # noqa: BLE001
            log.error("pipeline_curador_failed", raw_item_id=raw.id, error=str(exc))
            cur_failed += 1
    summary["curador"] = {"processed": cur_processed, "failed": cur_failed}

    # 3. Investigador
    scored_pending = fetch_approved_unenriched(limit=investigador_limit)
    inv_processed = 0
    inv_failed = 0
    for sc in scored_pending:
        try:
            enrich_scored_item(sc, persist=True)
            inv_processed += 1
        except Exception as exc:  # noqa: BLE001
            log.error("pipeline_investigador_failed", scored_item_id=sc.id, error=str(exc))
            inv_failed += 1
    summary["investigador"] = {"processed": inv_processed, "failed": inv_failed}

    # 4. Redator
    sb = supabase_client()
    enriched_pending = fetch_enriched_no_article(limit=redator_limit)
    red_processed = 0
    red_failed = 0
    if enriched_pending:
        scored_ids = [e.scored_item_id for e in enriched_pending]
        scored_resp = sb.table("scored_items").select("*").in_("id", scored_ids).execute()
        scored_by_id = {
            r["id"]: ScoredItem.model_validate(r) for r in (scored_resp.data or [])
        }
        for enr in enriched_pending:
            sc = scored_by_id.get(enr.scored_item_id)
            if sc is None:
                red_failed += 1
                continue
            try:
                draft_article(scored=sc, enriched=enr, persist=True)
                red_processed += 1
            except Exception as exc:  # noqa: BLE001
                log.error("pipeline_redator_failed", enriched_item_id=enr.id, error=str(exc))
                red_failed += 1
    summary["redator"] = {"processed": red_processed, "failed": red_failed}

    return summary


@router.post("/finalize/{article_id}")
async def pipeline_finalize(
    article_id: str,
    skip_visual: bool = Query(default=False),
    skip_distribute: bool = Query(default=False),
) -> dict[str, Any]:
    """Visual + Distribuidor pro article informado — chamado ao publicar."""
    article = fetch_article(article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="article não encontrado")

    visual_out = None
    if not skip_visual:
        visual_out = visualize_article(article, persist=True)
        article = fetch_article(article_id)  # reload com hero_image_alt atualizado
        if article is None:
            raise HTTPException(status_code=500, detail="article sumiu após visual")

    dist_out = None
    if not skip_distribute:
        dist_out = distribute_article(article, persist=True)

    return {
        "article_id": article_id,
        "visual": visual_out.model_dump() if visual_out else None,
        "distributed_channels": list((dist_out or {}).get("pack", {}).keys()) if dist_out else [],
        "social_post_ids": (dist_out or {}).get("persisted_ids", []) if dist_out else [],
    }
