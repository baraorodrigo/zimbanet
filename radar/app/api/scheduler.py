"""Endpoints pra inspecionar e controlar o scheduler em runtime."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app import scheduler as scheduler_mod
from app.config import get_settings

router = APIRouter()


def _job_to_dict(job: Any) -> dict[str, Any]:
    next_run = job.next_run_time.isoformat() if job.next_run_time else None
    return {
        "id": job.id,
        "name": job.name,
        "next_run_time": next_run,
        "trigger": str(job.trigger),
        "max_instances": job.max_instances,
        "coalesce": job.coalesce,
    }


@router.get("/status")
def scheduler_status() -> dict[str, Any]:
    """Estado atual do scheduler — útil pro painel de autônomo."""
    settings = get_settings()
    sched = scheduler_mod._scheduler
    if sched is None or not sched.running:
        return {
            "running": False,
            "enabled_in_config": settings.schedule_enabled,
            "jobs": [],
        }
    return {
        "running": True,
        "enabled_in_config": settings.schedule_enabled,
        "timezone": str(sched.timezone),
        "jobs": [_job_to_dict(j) for j in sched.get_jobs()],
    }


@router.post("/start")
def scheduler_start() -> dict[str, Any]:
    """Liga o scheduler (se config permitir)."""
    sched = scheduler_mod.start_scheduler()
    if sched is None:
        return {"running": False, "reason": "schedule_disabled_in_config"}
    return {
        "running": True,
        "jobs": [j.id for j in sched.get_jobs()],
    }


@router.post("/stop")
def scheduler_stop() -> dict[str, Any]:
    """Para o scheduler em runtime (config não muda)."""
    scheduler_mod.stop_scheduler()
    return {"running": False}


@router.post("/run/{job_id}")
def scheduler_run_now(job_id: str) -> dict[str, Any]:
    """Dispara um job agora (útil pra testar tick sem esperar intervalo)."""
    sched = scheduler_mod._scheduler
    if sched is None or not sched.running:
        return {"ok": False, "reason": "scheduler_not_running"}
    job = sched.get_job(job_id)
    if job is None:
        return {"ok": False, "reason": "job_not_found", "job_id": job_id}
    job.func()
    return {"ok": True, "job_id": job_id}
