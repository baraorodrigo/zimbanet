"""Backfill de uma janela de dias dos dois portais regionais — Portal Ahora e
Portal Click Sul — direto pra raw_items, sem passar pelo runner agendado.

A lógica de parsing/harvest vive em `app/sources/regional.py` (compartilhada
com o runner recorrente). Esse script só:

  · define a janela (default: últimos 7 dias)
  · cadastra/atualiza as sources no Supabase com `kind` correto
  · roda os harvesters com a janela longa, sem cap de `max_items`
  · faz dedup + upsert em `raw_items`

Uso:
    python -m scripts.backfill_week                  # últimos 7 dias
    python -m scripts.backfill_week --days 14        # últimos 14 dias
    python -m scripts.backfill_week --only ahora     # só Portal Ahora
    python -m scripts.backfill_week --only clicksul  # só Click Sul
    python -m scripts.backfill_week --dry-run        # não escreve no DB
    python -m scripts.backfill_week --upsert-sources # atualiza configs e sai
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

from app.clients import supabase_client
from app.logging import get_logger
from app.sources.regional import (
    AHORA_BASE,
    AHORA_SOURCE_ID,
    CLICKSUL_BASE,
    CLICKSUL_LIST_PAGES,
    CLICKSUL_SOURCE_ID,
    Article,
    harvest_ahora,
    harvest_clicksul,
    make_client,
)
from app.sources.dedup import content_hash, make_raw_id, semantic_hash

log = get_logger("scripts.backfill_week")


# ============================================================================
# Persistência — sources + raw_items (com dedup)
# ============================================================================
AHORA_CONFIG: dict[str, Any] = {
    "kind": "regional_ahora",
    "url": f"{AHORA_BASE}/",
    "archive_pattern": "/AAAA/MM/DD/",
    "selector_link": 'a[href*="/noticias/"]',
    "selector_title": "h1.elementor-heading-title",
    "selector_body": (
        '[data-widget_type="theme-post-content.default"] '
        ".elementor-widget-container"
    ),
    "window_hours": 36,
    "max_items_per_run": 15,
}

CLICKSUL_CONFIG: dict[str, Any] = {
    "kind": "regional_clicksul",
    "url": CLICKSUL_BASE + "/",
    "list_pages": list(CLICKSUL_LIST_PAGES),
    "selector_title": "h1.post-title",
    "selector_body": ".post-content",
    "date_meta": "article:published_time",
    "window_hours": 36,
    "max_items_per_run": 15,
}


def upsert_source(source_id: str, *, name: str, city: str, config: dict[str, Any]) -> None:
    """Cria ou atualiza a source (idempotente). Mantém `last_fetched_at` e
    `error_count` intactos — só mexe nos campos descritivos + config."""
    sb = supabase_client()
    existing = sb.table("sources").select("id").eq("id", source_id).limit(1).execute()
    payload: dict[str, Any] = {
        "id": source_id,
        "name": name,
        "type": "scraper",
        "config": config,
        "city": city,
        "priority": "medium",
        "active": True,
    }
    if existing.data:
        sb.table("sources").update(
            {"name": name, "config": config, "city": city, "type": "scraper", "active": True}
        ).eq("id", source_id).execute()
        log.info("source_updated", id=source_id, name=name)
    else:
        sb.table("sources").insert(payload).execute()
        log.info("source_created", id=source_id, name=name)


def ensure_recurring_sources() -> None:
    upsert_source(
        AHORA_SOURCE_ID,
        name="Portal Ahora — Imbituba",
        city="imbituba",
        config=AHORA_CONFIG,
    )
    upsert_source(
        CLICKSUL_SOURCE_ID,
        name="Portal Click Sul — Imbituba",
        city="imbituba",
        config=CLICKSUL_CONFIG,
    )


def articles_to_items(source_id: str, articles: list[Article]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for a in articles:
        ch = content_hash(a.url, a.title)
        sh = semantic_hash(a.title, a.body)
        out.append(
            {
                "id": make_raw_id(source_id, ch),
                "source_id": source_id,
                "title": a.title,
                "body": a.body,
                "url": a.url,
                "image_url": a.image_url,
                "published_at": a.published_at.isoformat() if a.published_at else None,
                "content_hash": ch,
                "semantic_hash": sh,
            }
        )
    return out


def filter_new(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return []
    sb = supabase_client()
    hashes = list({it["content_hash"] for it in items})
    urls = list({it["url"] for it in items})
    by_hash = (
        sb.table("raw_items").select("content_hash").in_("content_hash", hashes).execute()
    )
    by_url = sb.table("raw_items").select("url").in_("url", urls).execute()
    seen_hashes = {r["content_hash"] for r in (by_hash.data or [])}
    seen_urls = {r["url"] for r in (by_url.data or [])}
    fresh: list[dict[str, Any]] = []
    in_batch: set[str] = set()
    for it in items:
        if it["content_hash"] in seen_hashes:
            continue
        if it["url"] in seen_urls:
            continue
        if it["url"] in in_batch:
            continue
        in_batch.add(it["url"])
        fresh.append(it)
    return fresh


def flag_semantic_dupes(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return items
    sb = supabase_client()
    hashes = [it["semantic_hash"] for it in items]
    resp = (
        sb.table("raw_items").select("id,semantic_hash").in_("semantic_hash", hashes).execute()
    )
    existing = {r["semantic_hash"]: r["id"] for r in (resp.data or [])}
    in_batch: dict[str, str] = {}
    for it in items:
        sh = it["semantic_hash"]
        if sh in existing:
            it["is_duplicate"] = True
            it["duplicate_of"] = existing[sh]
        elif sh in in_batch:
            it["is_duplicate"] = True
            it["duplicate_of"] = in_batch[sh]
        else:
            in_batch[sh] = it["id"]
    return items


def persist(items: list[dict[str, Any]]) -> int:
    if not items:
        return 0
    sb = supabase_client()
    inserted = 0
    for i in range(0, len(items), 100):
        chunk = items[i : i + 100]
        resp = sb.table("raw_items").upsert(chunk, on_conflict="id").execute()
        inserted += len(resp.data or [])
    return inserted


# ============================================================================
# CLI
# ============================================================================
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=7, help="Janela em dias (default: 7)")
    parser.add_argument("--only", choices=["ahora", "clicksul"])
    parser.add_argument("--dry-run", action="store_true", help="Coleta e printa, sem persistir")
    parser.add_argument(
        "--upsert-sources",
        action="store_true",
        help="Só atualiza configs das duas sources e sai (sem coletar)",
    )
    args = parser.parse_args()

    if args.upsert_sources:
        ensure_recurring_sources()
        print("[ok] sources upsertadas com kind regional_*.")
        return 0

    today = datetime.now(timezone.utc)
    since = today - timedelta(days=args.days)
    until = today
    log.info("backfill_window", since=since.isoformat(), until=until.isoformat())

    if not args.dry_run:
        ensure_recurring_sources()

    totals: dict[str, dict[str, int]] = {}
    with make_client() as client:
        if args.only in (None, "ahora"):
            arts = harvest_ahora(client, since, until)
            items = articles_to_items(AHORA_SOURCE_ID, arts)
            fresh = filter_new(items)
            fresh = flag_semantic_dupes(fresh)
            inserted = 0 if args.dry_run else persist(fresh)
            totals["ahora"] = {
                "fetched": len(arts),
                "candidates": len(items),
                "fresh": len(fresh),
                "inserted": inserted,
            }
            log.info("ahora_done", **totals["ahora"])
        if args.only in (None, "clicksul"):
            arts = harvest_clicksul(client, since, until)
            items = articles_to_items(CLICKSUL_SOURCE_ID, arts)
            fresh = filter_new(items)
            fresh = flag_semantic_dupes(fresh)
            inserted = 0 if args.dry_run else persist(fresh)
            totals["clicksul"] = {
                "fetched": len(arts),
                "candidates": len(items),
                "fresh": len(fresh),
                "inserted": inserted,
            }
            log.info("clicksul_done", **totals["clicksul"])

    print("\n=== BACKFILL SUMMARY ===")
    for src, stats in totals.items():
        print(
            f"  {src:10s}: fetched={stats['fetched']:>3}  "
            f"candidates={stats['candidates']:>3}  fresh={stats['fresh']:>3}  "
            f"inserted={stats['inserted']:>3}"
        )
    if args.dry_run:
        print("  (dry-run: nada foi escrito)")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
