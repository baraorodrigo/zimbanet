"""Endpoints pra disparar agentes manualmente — útil pra debug e cron."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.agents.analista import analyze_article
from app.agents.curador import score_raw_item
from app.agents.distribuidor import distribute_article
from app.agents.investigador import enrich_scored_item
from app.agents.redator import draft_article
from app.agents.visual import visualize_article
from app.db.repositories import (
    fetch_approved_unenriched,
    fetch_article,
    fetch_enriched_no_article,
    fetch_published_articles_no_analysis,
    fetch_unscored_raw_items,
)
from app.logging import get_logger

router = APIRouter()
log = get_logger("api.agents")


@router.post("/curador/run")
async def run_curador(
    limit: int = Query(default=10, ge=1, le=100),
    persist: bool = Query(default=True),
) -> dict[str, Any]:
    pending = fetch_unscored_raw_items(limit=limit)
    results: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for item in pending:
        try:
            output, scored = score_raw_item(item, persist=persist)
            results.append(
                {
                    "raw_item_id": item.id,
                    "scored_item_id": scored.id if scored else None,
                    "decision": output.decision.value,
                    "editoria": output.editoria.value,
                    "relevance_score": output.relevance_score,
                    "risk_score": output.risk_score,
                }
            )
        except Exception as exc:  # noqa: BLE001
            log.error("curador_failed", raw_item_id=item.id, error=str(exc))
            errors.append({"raw_item_id": item.id, "error": str(exc)})

    return {"processed": len(results), "failed": len(errors), "results": results, "errors": errors}


@router.post("/investigador/run")
async def run_investigador(
    limit: int = Query(default=5, ge=1, le=50),
    persist: bool = Query(default=True),
) -> dict[str, Any]:
    pending = fetch_approved_unenriched(limit=limit)
    results: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for scored in pending:
        try:
            output, enriched = enrich_scored_item(scored, persist=persist)
            results.append(
                {
                    "scored_item_id": scored.id,
                    "enriched_item_id": enriched.id if enriched else None,
                    "confidence": output.confidence,
                    "stakeholders": len(output.stakeholders),
                }
            )
        except Exception as exc:  # noqa: BLE001
            log.error("investigador_failed", scored_item_id=scored.id, error=str(exc))
            errors.append({"scored_item_id": scored.id, "error": str(exc)})
    return {"processed": len(results), "failed": len(errors), "results": results, "errors": errors}


@router.post("/redator/run")
async def run_redator(
    limit: int = Query(default=5, ge=1, le=50),
    persist: bool = Query(default=True),
) -> dict[str, Any]:
    from app.clients import supabase_client
    from app.db.types import ScoredItem

    sb = supabase_client()
    pending = fetch_enriched_no_article(limit=limit)
    if not pending:
        return {"processed": 0, "failed": 0, "results": [], "errors": []}

    scored_ids = [e.scored_item_id for e in pending]
    scored_resp = sb.table("scored_items").select("*").in_("id", scored_ids).execute()
    scored_by_id = {
        r["id"]: ScoredItem.model_validate(r) for r in (scored_resp.data or [])
    }

    results: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for enriched in pending:
        scored = scored_by_id.get(enriched.scored_item_id)
        if scored is None:
            errors.append({"enriched_item_id": enriched.id, "error": "scored_item not found"})
            continue
        try:
            output, article = draft_article(scored=scored, enriched=enriched, persist=persist)
            results.append(
                {
                    "enriched_item_id": enriched.id,
                    "article_id": article.id if article else None,
                    "slug": output.slug,
                    "title": output.title,
                    "reading_minutes": output.reading_minutes,
                }
            )
        except Exception as exc:  # noqa: BLE001
            log.error("redator_failed", enriched_item_id=enriched.id, error=str(exc))
            errors.append({"enriched_item_id": enriched.id, "error": str(exc)})
    return {"processed": len(results), "failed": len(errors), "results": results, "errors": errors}


@router.post("/visual/run")
async def run_visual(
    article_id: str = Query(...),
    persist: bool = Query(default=True),
) -> dict[str, Any]:
    article = fetch_article(article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="article não encontrado")
    output = visualize_article(article, persist=persist)
    return {
        "article_id": article.id,
        "hero_image_alt": output.hero_image_alt,
        "image_prompt": output.image_prompt,
        "crop_hint": output.crop_hint,
    }


@router.post("/distribuidor/run")
async def run_distribuidor(
    article_id: str = Query(...),
    persist: bool = Query(default=True),
    render: bool | None = Query(default=None),
) -> dict[str, Any]:
    article = fetch_article(article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="article não encontrado")
    result = distribute_article(article, persist=persist, render=render)
    return {
        "article_id": article.id,
        "channels": list(result["pack"].keys()),
        "persisted_ids": result["persisted_ids"],
        "pack": result["pack"],
        "rendered": result.get("rendered", []),
    }


@router.post("/analista/run")
async def run_analista(
    limit: int = Query(default=5, ge=1, le=50),
    persist: bool = Query(default=True),
) -> dict[str, Any]:
    pending = fetch_published_articles_no_analysis(limit=limit)
    results: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for article in pending:
        try:
            output = analyze_article(article, persist=persist)
            results.append(
                {
                    "article_id": article.id,
                    "rating": output.rating,
                    "improvements": output.improvements,
                }
            )
        except Exception as exc:  # noqa: BLE001
            log.error("analista_failed", article_id=article.id, error=str(exc))
            errors.append({"article_id": article.id, "error": str(exc)})
    return {"processed": len(results), "failed": len(errors), "results": results, "errors": errors}
