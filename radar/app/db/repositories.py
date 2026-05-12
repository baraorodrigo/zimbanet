"""Camada thin sobre supabase-py — só funções, sem ORM.

Mantém SQL/REST do supabase-py concentrado aqui pra os agentes não vazarem
detalhe do client. Cada função recebe/devolve dataclass ou dict simples.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.clients import supabase_client
from app.db.types import (
    Article,
    ArticleStatus,
    AuditLogEntry,
    CuradorOutput,
    EnrichedItem,
    InvestigadorOutput,
    RawItem,
    RedatorOutput,
    ScoredItem,
    ScoredItemStatus,
    Source,
    VisualOutput,
)
from app.logging import get_logger

log = get_logger("repositories")


# ============================================================================
# sources
# ============================================================================
def fetch_active_sources(limit: int | None = None) -> list[Source]:
    sb = supabase_client()
    q = sb.table("sources").select("*").eq("active", True).order("priority", desc=False)
    if limit:
        q = q.limit(limit)
    resp = q.execute()
    return [Source.model_validate(r) for r in (resp.data or [])]


def fetch_source_by_id(source_id: str) -> Source | None:
    sb = supabase_client()
    resp = sb.table("sources").select("*").eq("id", source_id).limit(1).execute()
    rows = resp.data or []
    return Source.model_validate(rows[0]) if rows else None


def update_source_run(source_id: str, *, error: bool) -> None:
    sb = supabase_client()
    payload: dict[str, Any] = {"last_fetched_at": datetime.now(timezone.utc).isoformat()}
    if error:
        # increment via select+update (sem RPC)
        cur = sb.table("sources").select("error_count").eq("id", source_id).limit(1).execute()
        rows = cur.data or []
        if rows:
            payload["error_count"] = (rows[0].get("error_count") or 0) + 1
    else:
        payload["error_count"] = 0
    sb.table("sources").update(payload).eq("id", source_id).execute()


# ============================================================================
# raw_items
# ============================================================================
def fetch_unscored_raw_items(limit: int = 20) -> list[RawItem]:
    """Pega raw_items sem scored_item correspondente — ordenados por mais recentes."""
    sb = supabase_client()
    raw_resp = (
        sb.table("raw_items")
        .select("*")
        .eq("is_duplicate", False)
        .order("fetched_at", desc=True)
        .limit(limit * 3)
        .execute()
    )
    raw_rows: list[dict[str, Any]] = raw_resp.data or []
    if not raw_rows:
        return []

    raw_ids = [r["id"] for r in raw_rows]
    scored_resp = (
        sb.table("scored_items").select("raw_item_id").in_("raw_item_id", raw_ids).execute()
    )
    scored_ids = {row["raw_item_id"] for row in (scored_resp.data or [])}
    pending = [r for r in raw_rows if r["id"] not in scored_ids][:limit]
    return [RawItem.model_validate(r) for r in pending]


def fetch_raw_item(raw_item_id: str) -> RawItem | None:
    sb = supabase_client()
    resp = sb.table("raw_items").select("*").eq("id", raw_item_id).limit(1).execute()
    rows = resp.data or []
    return RawItem.model_validate(rows[0]) if rows else None


# ============================================================================
# scored_items
# ============================================================================
def insert_scored_item(
    *,
    raw_item_id: str,
    output: CuradorOutput,
    prompt_version: str,
) -> ScoredItem:
    sb = supabase_client()
    scored_id = f"scored_{raw_item_id}"
    payload = {
        "id": scored_id,
        "raw_item_id": raw_item_id,
        "relevance_score": output.relevance_score,
        "virality_score": output.virality_score,
        "risk_score": output.risk_score,
        "risk_flags": output.risk_flags,
        "editoria": output.editoria.value,
        "classification": output.classification,
        "decision": output.decision.value,
        "ai_reasoning": output.reasoning,
        "prompt_version": prompt_version,
        "status": ScoredItemStatus.scored.value,
        "scored_at": datetime.now(timezone.utc).isoformat(),
    }
    resp = sb.table("scored_items").upsert(payload, on_conflict="id").execute()
    row = (resp.data or [None])[0]
    if row is None:
        raise RuntimeError(f"Falha ao inserir scored_item pra raw_item_id={raw_item_id}")
    return ScoredItem.model_validate(row)


def fetch_approved_unenriched(limit: int = 10) -> list[ScoredItem]:
    """scored_items com decision=approve ou investigate, sem enriched_item."""
    sb = supabase_client()
    scored_resp = (
        sb.table("scored_items")
        .select("*")
        .in_("decision", ["approve", "investigate"])
        .eq("status", ScoredItemStatus.scored.value)
        .order("scored_at", desc=True)
        .limit(limit * 3)
        .execute()
    )
    rows = scored_resp.data or []
    if not rows:
        return []

    scored_ids = [r["id"] for r in rows]
    enriched_resp = (
        sb.table("enriched_items")
        .select("scored_item_id")
        .in_("scored_item_id", scored_ids)
        .execute()
    )
    enriched_set = {r["scored_item_id"] for r in (enriched_resp.data or [])}
    pending = [r for r in rows if r["id"] not in enriched_set][:limit]
    return [ScoredItem.model_validate(r) for r in pending]


def update_scored_item_status(scored_item_id: str, status: ScoredItemStatus) -> None:
    sb = supabase_client()
    sb.table("scored_items").update({"status": status.value}).eq("id", scored_item_id).execute()


# ============================================================================
# enriched_items
# ============================================================================
def insert_enriched_item(
    *,
    scored_item_id: str,
    output: InvestigadorOutput,
    prompt_version: str,
) -> EnrichedItem:
    sb = supabase_client()
    payload = {
        "scored_item_id": scored_item_id,
        "briefing": output.briefing,
        "historical_context": output.historical_context,
        "fact_check": output.fact_check,
        "stakeholders": output.stakeholders,
        "photo_suggestions": output.photo_suggestions,
        "web_searches": output.web_searches,
        "confidence": output.confidence,
        "prompt_version": prompt_version,
        "enriched_at": datetime.now(timezone.utc).isoformat(),
    }
    resp = sb.table("enriched_items").insert(payload).execute()
    row = (resp.data or [None])[0]
    if row is None:
        raise RuntimeError(f"Falha ao inserir enriched_item pra scored_item_id={scored_item_id}")
    update_scored_item_status(scored_item_id, ScoredItemStatus.enriched)
    return EnrichedItem.model_validate(row)


def fetch_enriched_no_article(limit: int = 10) -> list[EnrichedItem]:
    sb = supabase_client()
    enr_resp = (
        sb.table("enriched_items")
        .select("*")
        .order("enriched_at", desc=True)
        .limit(limit * 3)
        .execute()
    )
    rows = enr_resp.data or []
    if not rows:
        return []
    enriched_ids = [r["id"] for r in rows]
    art_resp = (
        sb.table("articles")
        .select("enriched_item_id")
        .in_("enriched_item_id", enriched_ids)
        .execute()
    )
    drafted = {r["enriched_item_id"] for r in (art_resp.data or [])}
    pending = [r for r in rows if r["id"] not in drafted][:limit]
    return [EnrichedItem.model_validate(r) for r in pending]


# ============================================================================
# articles
# ============================================================================
def insert_article(
    *,
    scored_item_id: str | None,
    enriched_item_id: str | None,
    output: RedatorOutput,
    risk_score: float | None,
    confidence: float | None,
    prompt_version: str,
) -> Article:
    sb = supabase_client()
    slug = _ensure_unique_slug(output.slug)
    payload = {
        "scored_item_id": scored_item_id,
        "enriched_item_id": enriched_item_id,
        "slug": slug,
        "editoria": _editoria_from_tags(output, fallback="cidade"),
        "kicker": output.kicker,
        "title": output.title,
        "subtitle": output.subtitle,
        "lede": output.lede,
        "body": output.body,
        "byline": output.byline,
        "reading_minutes": output.reading_minutes,
        "hero_image_alt": output.hero_image_alt,
        "tags": output.tags,
        "cities": output.cities,
        "is_breaking": output.is_breaking,
        "is_exclusive": output.is_exclusive,
        "status": ArticleStatus.draft.value,
        "risk_score": risk_score,
        "confidence": confidence,
        "prompt_version": prompt_version,
    }
    resp = sb.table("articles").insert(payload).execute()
    row = (resp.data or [None])[0]
    if row is None:
        raise RuntimeError("Falha ao inserir article")
    if scored_item_id:
        update_scored_item_status(scored_item_id, ScoredItemStatus.drafted)
    return Article.model_validate(row)


def update_article_visual(
    *,
    article_id: str,
    output: VisualOutput,
    visual_slots: dict[str, Any] | None = None,
) -> None:
    """Persiste alt-text e (opcional) slots visuais pra pré-popular o Estúdio.

    visual_slots é o dict serializado de VisualSlots (port Python de
    visual-slots.ts). Quando presente, vai pra coluna jsonb articles.visual_slots
    — assim o admin abre /admin/estudio/<id> e os slots já vêm prontos pra
    refino + 'Gerar 4 variações IA' sem partir do zero.
    """
    sb = supabase_client()
    payload: dict[str, Any] = {"hero_image_alt": output.hero_image_alt}
    if visual_slots is not None:
        payload["visual_slots"] = visual_slots
    sb.table("articles").update(payload).eq("id", article_id).execute()


def fetch_article(article_id: str) -> Article | None:
    sb = supabase_client()
    resp = sb.table("articles").select("*").eq("id", article_id).limit(1).execute()
    rows = resp.data or []
    return Article.model_validate(rows[0]) if rows else None


def fetch_published_articles_no_analysis(limit: int = 10) -> list[Article]:
    """Articles publicados que ainda não passaram pelo Analista.
    Cruza articles.status=published x audit_log(action=post_review)."""
    sb = supabase_client()
    resp = (
        sb.table("articles")
        .select("*")
        .eq("status", ArticleStatus.published.value)
        .order("published_at", desc=True)
        .limit(limit * 3)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    audit_resp = (
        sb.table("audit_log")
        .select("entity_id")
        .eq("entity_type", "article")
        .eq("action", "post_review")
        .in_("entity_id", ids)
        .execute()
    )
    reviewed = {r["entity_id"] for r in (audit_resp.data or [])}
    pending = [r for r in rows if r["id"] not in reviewed][:limit]
    return [Article.model_validate(r) for r in pending]


def fetch_drafts_for_autopublish(
    *,
    min_confidence: float,
    max_risk: float,
    limit: int = 5,
) -> list[Article]:
    """Drafts/reviews confiáveis o suficiente pra ir ao ar sozinhos."""
    sb = supabase_client()
    resp = (
        sb.table("articles")
        .select("*")
        .in_("status", [ArticleStatus.draft.value, ArticleStatus.review.value])
        .gte("confidence", min_confidence)
        .lte("risk_score", max_risk)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [Article.model_validate(r) for r in (resp.data or [])]


def publish_article(article_id: str, *, auto: bool = False) -> Article | None:
    """Promove um artigo a publicado. Aplica published_at=now."""
    sb = supabase_client()
    payload = {
        "status": ArticleStatus.published.value,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "auto_published": auto,
    }
    resp = (
        sb.table("articles")
        .update(payload)
        .eq("id", article_id)
        .execute()
    )
    rows = resp.data or []
    return Article.model_validate(rows[0]) if rows else None


def fetch_articles_without_visual(limit: int = 5) -> list[Article]:
    """Articles em draft/review/published sem briefing visual (audit action=visual_brief)."""
    sb = supabase_client()
    resp = (
        sb.table("articles")
        .select("*")
        .in_(
            "status",
            [
                ArticleStatus.draft.value,
                ArticleStatus.review.value,
                ArticleStatus.scheduled.value,
                ArticleStatus.published.value,
            ],
        )
        .order("created_at", desc=True)
        .limit(limit * 3)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    audit_resp = (
        sb.table("audit_log")
        .select("entity_id")
        .eq("entity_type", "article")
        .eq("action", "visual_brief")
        .in_("entity_id", ids)
        .execute()
    )
    visualized = {r["entity_id"] for r in (audit_resp.data or [])}
    pending = [r for r in rows if r["id"] not in visualized][:limit]
    return [Article.model_validate(r) for r in pending]


# ============================================================================
# audit_log
# ============================================================================
def insert_audit_log(entry: AuditLogEntry) -> None:
    sb = supabase_client()
    payload = entry.model_dump(exclude_none=True)
    sb.table("audit_log").insert(payload).execute()


# ============================================================================
# helpers
# ============================================================================
def _ensure_unique_slug(slug: str) -> str:
    sb = supabase_client()
    resp = sb.table("articles").select("id").eq("slug", slug).limit(1).execute()
    if not (resp.data or []):
        return slug
    return f"{slug}-{uuid4().hex[:6]}"


def _editoria_from_tags(output: RedatorOutput, fallback: str) -> str:
    # O Redator não devolve editoria explícita — herda do scored_item via caller.
    # Caller substitui esse default ao chamar via service layer. Mantido pra robustez.
    return fallback
