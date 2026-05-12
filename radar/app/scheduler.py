"""APScheduler — orquestração periódica do pipeline.

Quando SCHEDULE_ENABLED=true, ticks rodam em background:
- Coletor (RSS+scrapers) a cada 30min
- Curador (Haiku, barato) a cada 15min — bate em todo raw_item novo
- Investigador (Sonnet) a cada 60min, máx 3 itens — caro mas vale
- Redator (Sonnet) a cada 90min, máx 3 itens — gera drafts pra fila
- Visual (Haiku) a cada 120min, máx 3 — briefing imagem dos drafts
- Analista (Haiku) a cada 180min, máx 3 — review pós-publish
"""

from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.agents.analista import analyze_article
from app.agents.curador import score_raw_item
from app.agents.investigador import enrich_scored_item
from app.agents.redator import draft_article
from app.agents.visual import visualize_article
from app.clients import supabase_client
from app.config import get_settings
from app.db.repositories import (
    fetch_approved_unenriched,
    fetch_articles_without_visual,
    fetch_drafts_for_autopublish,
    fetch_enriched_no_article,
    fetch_published_articles_no_analysis,
    fetch_unscored_raw_items,
    insert_audit_log,
    publish_article,
)
from app.db.types import AuditLogEntry, ScoredItem
from app.logging import get_logger
from app.push.client import notify_breaking_published
from app.sources.runner import run_all_active

log = get_logger("scheduler")

_scheduler: AsyncIOScheduler | None = None


def _curador_tick(batch_size: int = 5) -> None:
    """Triagem automática — só roda Curador (Haiku, barato)."""
    try:
        pending = fetch_unscored_raw_items(limit=batch_size)
        if not pending:
            log.debug("curador_tick_empty")
            return
        log.info("curador_tick_start", count=len(pending))
        ok = 0
        fail = 0
        for item in pending:
            try:
                score_raw_item(item, persist=True)
                ok += 1
            except Exception as exc:  # noqa: BLE001
                fail += 1
                log.error("curador_tick_item_failed", raw_item_id=item.id, error=str(exc))
        log.info("curador_tick_done", ok=ok, fail=fail)
    except Exception as exc:  # noqa: BLE001
        log.error("curador_tick_outer_failed", error=str(exc))


def _collect_tick() -> None:
    """Coleta de raw_items — RSS + scraper. Não toca em LLM."""
    try:
        results = run_all_active()
        total = sum(r.get("inserted", 0) for r in results)
        log.info("collect_tick_done", sources=len(results), inserted=total)
    except Exception as exc:  # noqa: BLE001
        log.error("collect_tick_failed", error=str(exc))


def _investigador_tick(batch_size: int = 3) -> None:
    """Enriquecimento — Sonnet. Cap baixo pq é caro."""
    try:
        pending = fetch_approved_unenriched(limit=batch_size)
        if not pending:
            log.debug("investigador_tick_empty")
            return
        log.info("investigador_tick_start", count=len(pending))
        ok = 0
        fail = 0
        for scored in pending:
            try:
                enrich_scored_item(scored, persist=True)
                ok += 1
            except Exception as exc:  # noqa: BLE001
                fail += 1
                log.error(
                    "investigador_tick_item_failed",
                    scored_item_id=scored.id,
                    error=str(exc),
                )
        log.info("investigador_tick_done", ok=ok, fail=fail)
    except Exception as exc:  # noqa: BLE001
        log.error("investigador_tick_outer_failed", error=str(exc))


def _redator_tick(batch_size: int = 3) -> None:
    """Redação — Sonnet. Pega enriched_items sem artigo e gera draft."""
    try:
        pending = fetch_enriched_no_article(limit=batch_size)
        if not pending:
            log.debug("redator_tick_empty")
            return
        log.info("redator_tick_start", count=len(pending))
        ok = 0
        fail = 0
        client = supabase_client.get_supabase()
        for enriched in pending:
            try:
                row = (
                    client.table("scored_items")
                    .select("*")
                    .eq("id", str(enriched.scored_item_id))
                    .limit(1)
                    .execute()
                )
                if not row.data:
                    log.warning(
                        "redator_tick_scored_missing",
                        enriched_item_id=enriched.id,
                    )
                    fail += 1
                    continue
                scored = ScoredItem.model_validate(row.data[0])
                draft_article(scored=scored, enriched=enriched, persist=True)
                ok += 1
            except Exception as exc:  # noqa: BLE001
                fail += 1
                log.error(
                    "redator_tick_item_failed",
                    enriched_item_id=enriched.id,
                    error=str(exc),
                )
        log.info("redator_tick_done", ok=ok, fail=fail)
    except Exception as exc:  # noqa: BLE001
        log.error("redator_tick_outer_failed", error=str(exc))


def _visual_tick(batch_size: int = 3) -> None:
    """Briefing visual — Haiku. Pega articles sem visual_brief no audit_log."""
    try:
        pending = fetch_articles_without_visual(limit=batch_size)
        if not pending:
            log.debug("visual_tick_empty")
            return
        log.info("visual_tick_start", count=len(pending))
        ok = 0
        fail = 0
        for article in pending:
            try:
                visualize_article(article, persist=True)
                ok += 1
            except Exception as exc:  # noqa: BLE001
                fail += 1
                log.error(
                    "visual_tick_item_failed",
                    article_id=article.id,
                    error=str(exc),
                )
        log.info("visual_tick_done", ok=ok, fail=fail)
    except Exception as exc:  # noqa: BLE001
        log.error("visual_tick_outer_failed", error=str(exc))


def _analista_tick(batch_size: int = 3) -> None:
    """Análise pós-publish — Haiku. Roda em articles publicados sem post_review."""
    try:
        pending = fetch_published_articles_no_analysis(limit=batch_size)
        if not pending:
            log.debug("analista_tick_empty")
            return
        log.info("analista_tick_start", count=len(pending))
        ok = 0
        fail = 0
        for article in pending:
            try:
                analyze_article(article, persist=True)
                ok += 1
            except Exception as exc:  # noqa: BLE001
                fail += 1
                log.error(
                    "analista_tick_item_failed",
                    article_id=article.id,
                    error=str(exc),
                )
        log.info("analista_tick_done", ok=ok, fail=fail)
    except Exception as exc:  # noqa: BLE001
        log.error("analista_tick_outer_failed", error=str(exc))


def _autopublish_tick(batch_size: int = 5) -> None:
    """Promove drafts confiáveis (confidence>=th, risk<=th) a 'published'."""
    settings = get_settings()
    if not settings.autopublish_enabled:
        log.debug("autopublish_disabled")
        return
    try:
        pending = fetch_drafts_for_autopublish(
            min_confidence=settings.autopublish_min_confidence,
            max_risk=settings.autopublish_max_risk,
            limit=batch_size,
        )
        if not pending:
            log.debug("autopublish_tick_empty")
            return
        log.info(
            "autopublish_tick_start",
            count=len(pending),
            min_conf=settings.autopublish_min_confidence,
            max_risk=settings.autopublish_max_risk,
        )
        ok = 0
        fail = 0
        for article in pending:
            try:
                published = publish_article(article.id, auto=True)
                if not published:
                    fail += 1
                    continue
                insert_audit_log(
                    AuditLogEntry(
                        entity_type="article",
                        entity_id=article.id,
                        action="auto_publish",
                        actor="scheduler",
                        agent="autopublisher",
                        metadata={
                            "confidence": article.confidence,
                            "risk_score": article.risk_score,
                        },
                    )
                )
                # Breaking news → dispara push pra subscribers do portal.
                # publish_article retorna o artigo atualizado; podemos checar
                # is_breaking direto sem outro round-trip.
                if getattr(published, "is_breaking", False):
                    notify_breaking_published(str(published.id))
                ok += 1
            except Exception as exc:  # noqa: BLE001
                fail += 1
                log.error(
                    "autopublish_tick_item_failed",
                    article_id=article.id,
                    error=str(exc),
                )
        log.info("autopublish_tick_done", ok=ok, fail=fail)
    except Exception as exc:  # noqa: BLE001
        log.error("autopublish_tick_outer_failed", error=str(exc))


def start_scheduler() -> AsyncIOScheduler | None:
    global _scheduler
    settings = get_settings()
    if not settings.schedule_enabled:
        log.info("scheduler_disabled")
        return None
    if _scheduler and _scheduler.running:
        return _scheduler

    scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")
    scheduler.add_job(
        _collect_tick,
        trigger=IntervalTrigger(minutes=30),
        id="collect_tick",
        name="Coletor — RSS + scrapers",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _curador_tick,
        trigger=IntervalTrigger(minutes=15),
        id="curador_tick",
        name="Curador — triagem editorial",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _investigador_tick,
        trigger=IntervalTrigger(minutes=60),
        id="investigador_tick",
        name="Investigador — enriquecimento (Sonnet)",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _redator_tick,
        trigger=IntervalTrigger(minutes=90),
        id="redator_tick",
        name="Redator — gera drafts (Sonnet)",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _visual_tick,
        trigger=IntervalTrigger(minutes=120),
        id="visual_tick",
        name="Visual — briefing imagem (Haiku)",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _analista_tick,
        trigger=IntervalTrigger(minutes=180),
        id="analista_tick",
        name="Analista — review pós-publish (Haiku)",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _autopublish_tick,
        trigger=IntervalTrigger(minutes=20),
        id="autopublish_tick",
        name="Auto-publish — drafts confiáveis ao ar",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    log.info("scheduler_started", jobs=[j.id for j in scheduler.get_jobs()])
    return scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("scheduler_stopped")
    _scheduler = None
