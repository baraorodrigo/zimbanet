"""Endpoints de coleta — disparam o Coletor manualmente."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.db.repositories import fetch_source_by_id
from app.logging import get_logger
from app.sources.runner import run_all_active, run_source

router = APIRouter()
log = get_logger("api.collect")


@router.post("/run")
async def collect_run_all(
    limit: int | None = Query(default=None, ge=1, le=100),
) -> dict[str, Any]:
    """Roda todas as sources ativas (ou primeiras `limit`)."""
    results = run_all_active(limit=limit)
    return {
        "sources_run": len(results),
        "total_inserted": sum(r.get("inserted", 0) for r in results),
        "results": results,
    }


@router.post("/run/{source_id}")
async def collect_run_one(source_id: str) -> dict[str, Any]:
    """Roda uma source específica."""
    source = fetch_source_by_id(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail=f"source {source_id} não encontrada")
    return run_source(source)
