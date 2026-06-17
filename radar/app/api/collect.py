"""Endpoints de coleta — disparam o Coletor manualmente."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db.repositories import fetch_source_by_id
from app.logging import get_logger
from app.sources.runner import run_all_active, run_source, submit_manual_url

router = APIRouter()
log = get_logger("api.collect")


class SubmitUrlBody(BaseModel):
    url: str
    note: str | None = None


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


@router.post("/submit-url")
async def collect_submit_url(body: SubmitUrlBody) -> dict[str, Any]:
    """Recebe uma URL de reportagem (Hermes via MCP), raspa, deduplica, salva como
    pauta bruta da fonte 'hermes_manual_web' e roda o Curador. Não publica."""
    url = (body.url or "").strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="url inválida (use http:// ou https://)")
    return submit_manual_url(url, note=body.note)
