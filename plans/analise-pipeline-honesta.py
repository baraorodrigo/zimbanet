"""Analise honesta do estado do pipeline ZIMBANET."""
import os, sys, json
from datetime import datetime, timedelta, timezone
import urllib.request
import urllib.parse

URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEAD = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def get(path, params=None, prefer=None):
    q = "?" + urllib.parse.urlencode(params) if params else ""
    h = dict(HEAD)
    if prefer:
        h["Prefer"] = prefer
    req = urllib.request.Request(f"{URL}/rest/v1/{path}{q}", headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        cr = r.headers.get("content-range", "")
        body = r.read().decode("utf-8")
    return json.loads(body), cr


def header(t):
    print("\n" + "=" * 70)
    print(t)
    print("=" * 70)


# --- 1. FONTES: status, ultima coleta, erros ---
header("1. FONTES CADASTRADAS")
srcs, _ = get(
    "sources",
    {"select": "id,name,type,priority,active,last_fetched_at,error_count", "order": "name.asc"},
)
print(f"Total: {len(srcs)} fontes\n")
print(f"{'Nome':<45} {'Tipo':<10} {'Pri':<6} {'Ativa':<6} {'Erros':<6} {'Ultima coleta'}")
print("-" * 110)
for s in srcs:
    name = s["name"][:43]
    last = s.get("last_fetched_at") or "nunca"
    if last != "nunca":
        last = last[:16].replace("T", " ")
    ativa = "SIM" if s["active"] else "PAUSA"
    print(f"{name:<45} {s['type']:<10} {s['priority']:<6} {ativa:<6} {s['error_count']:<6} {last}")

# --- 2. FUNIL POR FONTE ULTIMOS 30 DIAS ---
header("2. FUNIL POR FONTE - ULTIMOS 30 DIAS")
cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

# raw por fonte
raw_by_src = {}
for s in srcs:
    _, cr = get(
        "raw_items",
        {"select": "id", "source_id": f"eq.{s['id']}", "fetched_at": f"gte.{cutoff}"},
        prefer="count=exact",
    )
    raw_by_src[s["id"]] = int(cr.split("/")[-1]) if cr else 0

# scored ja vem de raw, query: scored.raw_item_id -> raw.source_id
# Mais facil: scored_items tem source_id? Vamos checar.
try:
    sample, _ = get("scored_items", {"select": "*", "limit": "1"})
    print(f"Colunas scored_items: {list(sample[0].keys()) if sample else 'vazio'}")
except Exception as e:
    print(f"erro scored_items: {e}")

# articles por fonte: articles.scored_item_id -> scored.raw_item_id -> raw.source_id
# Vamos puxar todos articles + raw_items recent e juntar local
arts, _ = get(
    "articles",
    {
        "select": "id,scored_item_id,status,editoria,created_at,confidence_score,auto_published",
        "created_at": f"gte.{cutoff}",
        "order": "created_at.desc",
    },
)
print(f"\nArtigos ultimos 30d: {len(arts)}")
status_counts = {}
for a in arts:
    status_counts[a["status"]] = status_counts.get(a["status"], 0) + 1
print(f"Por status: {status_counts}")

# pega scored_items dos arts
scored_ids = [a["scored_item_id"] for a in arts if a.get("scored_item_id")]
print(f"Articles com scored_item_id: {len(scored_ids)}")

if scored_ids:
    # busca em batches de 50
    raw_ids_by_scored = {}
    for i in range(0, len(scored_ids), 50):
        batch = scored_ids[i : i + 50]
        sci, _ = get(
            "scored_items",
            {"select": "id,raw_item_id", "id": f"in.({','.join(batch)})"},
        )
        for s in sci:
            raw_ids_by_scored[s["id"]] = s["raw_item_id"]

    raw_ids = list(set(v for v in raw_ids_by_scored.values() if v))
    src_by_raw = {}
    for i in range(0, len(raw_ids), 50):
        batch = raw_ids[i : i + 50]
        rwi, _ = get(
            "raw_items",
            {"select": "id,source_id", "id": f"in.({','.join(batch)})"},
        )
        for r in rwi:
            src_by_raw[r["id"]] = r["source_id"]

    src_to_articles = {}
    for a in arts:
        sci = a.get("scored_item_id")
        if not sci:
            continue
        rid = raw_ids_by_scored.get(sci)
        if not rid:
            continue
        sid = src_by_raw.get(rid)
        if sid:
            src_to_articles.setdefault(sid, []).append(a)
else:
    src_to_articles = {}

# Print funil
print(f"\n{'Fonte':<45} {'Raw 30d':<10} {'Artigos 30d':<12} {'Publicados'}")
print("-" * 90)
for s in srcs:
    rid = s["id"]
    raw = raw_by_src.get(rid, 0)
    arts_s = src_to_articles.get(rid, [])
    pub = sum(1 for a in arts_s if a["status"] == "published")
    print(f"{s['name'][:43]:<45} {raw:<10} {len(arts_s):<12} {pub}")

# --- 3. ARTICLES REJECTED RECENTES ---
header("3. ARTIGOS REJEITADOS (curador) - ULTIMOS 30D")
rejs, _ = get(
    "articles",
    {
        "select": "title,editoria,created_at,confidence_score",
        "status": "eq.rejected",
        "created_at": f"gte.{cutoff}",
        "order": "created_at.desc",
        "limit": "20",
    },
)
print(f"Total rejected (30d): {len(rejs)}\n")
for r in rejs[:15]:
    print(f"- [{r.get('confidence_score'):.2f}] {r['editoria']}: {r['title'][:80]}")

# --- 4. ENRICHED ITEMS PRESOS ---
header("4. FILA ENRICHED_ITEMS")
try:
    enrs, cr = get("enriched_items", {"select": "id", "limit": "1"}, prefer="count=exact")
    total_enr = int(cr.split("/")[-1])
    print(f"Total enriched_items: {total_enr}")
    sample, _ = get("enriched_items", {"select": "*", "limit": "1"})
    if sample:
        print(f"Colunas: {list(sample[0].keys())}")
    # quantos viraram article?
    eids = []
    for off in range(0, min(total_enr, 500), 100):
        batch, _ = get("enriched_items", {"select": "id", "limit": "100", "offset": str(off)})
        eids.extend([e["id"] for e in batch])
    print(f"Pegou {len(eids)} ids")
except Exception as e:
    print(f"erro: {e}")

# --- 5. RAW_ITEMS ULTIMAS 24H POR FONTE ---
header("5. RAW_ITEMS ULTIMAS 24H POR FONTE")
cutoff24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
for s in srcs:
    _, cr = get(
        "raw_items",
        {"select": "id", "source_id": f"eq.{s['id']}", "fetched_at": f"gte.{cutoff24h}"},
        prefer="count=exact",
    )
    n = int(cr.split("/")[-1]) if cr else 0
    if n > 0 or not s["active"]:
        continue
    print(f"  {s['name'][:50]:<52} {n} itens 24h")

# Resumo final
header("RESUMO FINAL")
ativas = [s for s in srcs if s["active"]]
paradas = [s for s in srcs if s["active"] and (s["last_fetched_at"] is None or s["last_fetched_at"] < cutoff24h)]
com_erro = [s for s in srcs if s["error_count"] > 0]
print(f"Fontes ativas: {len(ativas)}/{len(srcs)}")
print(f"Sem coletar nas ultimas 24h: {len(paradas)}")
print(f"Com erros: {len(com_erro)}")
print(f"Artigos 30d: {len(arts)}")
print(f"Publicados 30d: {status_counts.get('published', 0)}")
print(f"Rejeitados 30d: {status_counts.get('rejected', 0)}")
print(f"Draft 30d: {status_counts.get('draft', 0)}")
