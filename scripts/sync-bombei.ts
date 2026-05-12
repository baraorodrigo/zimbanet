// Sync BOMBEI legado → ZIMBANET Supabase.
//
// O BOMBEI roda local em :8000 e escreve no Postgres dele. Esse script:
//   1. Puxa /blog/posts (publicados) e /drafts/published (publicados no IG)
//   2. Mapeia pro shape ZIMBANET (articles + social_posts)
//   3. Upsert no Supabase via service role
//
// Idempotente — usa `slug` (articles) e `external_url` (social_posts) como chave natural.
//
// Como rodar:  npm run sync-bombei
//
// Pré-requisitos:
//   - BOMBEI rodando em http://localhost:8000
//   - .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---- env loader ------------------------------------------------------------
function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (process.env[k] === undefined) {
        process.env[k] = v.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // ignore
  }
}
loadDotEnv();

// ---- types -----------------------------------------------------------------
type BombeiBlogPost = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  corpo_markdown?: string;
  cover_image_url: string | null;
  cover_image_prompt: string | null;
  categoria: string;
  tags: string[] | null;
  status: string;
  published_at: string | null;
  autor: string | null;
  seo_description: string | null;
  reading_time_min: number | null;
  draft_id: string | null;
  pauta_id: string | null;
  created_at: string;
  updated_at: string;
};

type BombeiBlogList = { items: BombeiBlogPost[]; total?: number };

type BombeiDraft = {
  draft_id: string;
  title: string;
  caption: string;
  hashtags?: string[];
  source_url?: string;
  published_at?: string | null;
  instagram_permalink?: string | null;
  generated_at?: string;
  sent_to_telegram?: boolean;
};

// ---- mapping ---------------------------------------------------------------
const CATEGORIA_TO_EDITORIA: Record<string, string> = {
  flagra: "cidade",
  rostos: "cidade",
  fala: "opiniao",
  polemica: "politica",
  evento: "cultura",
  praia: "praias",
  breaking: "cidade",
  outros: "cidade",
};

function mapEditoria(categoria: string): string {
  return CATEGORIA_TO_EDITORIA[categoria.toLowerCase()] ?? "cidade";
}

// ---- BOMBEI client ---------------------------------------------------------
const BOMBEI = process.env.BOMBEI_API_URL ?? "http://localhost:8000";

async function bombei<T>(path: string): Promise<T> {
  const res = await fetch(`${BOMBEI}${path}`);
  if (!res.ok) throw new Error(`BOMBEI ${path} → ${res.status}`);
  return (await res.json()) as T;
}

// ---- sync articles ---------------------------------------------------------
type ArticleLink = { articleId: string; slug: string; draftId: string | null };

async function syncArticles(supabase: SupabaseClient): Promise<ArticleLink[]> {
  console.log("→ /blog/posts (BOMBEI)");
  // Lista paginada (limit max=100); body completo vem em /blog/posts/{slug}
  const all: BombeiBlogPost[] = [];
  let offset = 0;
  while (true) {
    const page = await bombei<BombeiBlogList>(`/blog/posts?limit=100&offset=${offset}`);
    if (!page.items.length) break;
    all.push(...page.items);
    if (page.items.length < 100) break;
    offset += 100;
  }
  const posts = all.filter((p) => p.status === "published");
  console.log(`  ${posts.length} publicados (de ${all.length} totais)`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  const links: ArticleLink[] = [];

  for (const p of posts) {
    // Busca corpo individual
    let body = "";
    try {
      const full = await bombei<BombeiBlogPost>(`/blog/posts/${p.slug}`);
      body = full.corpo_markdown ?? "";
    } catch (e) {
      console.error(`  ✗ ${p.slug} — falhou ao buscar body: ${e}`);
      failed++;
      continue;
    }

    if (body.length < 20) {
      console.log(`  ⊘ ${p.slug} — body curto, pulando`);
      continue;
    }

    const editoria = mapEditoria(p.categoria);
    const isBreaking = p.categoria.toLowerCase() === "breaking";

    // Upsert por slug
    const { data: existing } = await supabase
      .from("articles")
      .select("id, updated_at")
      .eq("slug", p.slug)
      .maybeSingle<{ id: string; updated_at: string }>();

    const row = {
      slug: p.slug,
      editoria,
      title: p.titulo,
      subtitle: p.subtitulo,
      lede: p.seo_description,
      body,
      byline: p.autor ?? "Redação ZIMBANET",
      reading_minutes: p.reading_time_min,
      hero_image_url: p.cover_image_url,
      hero_image_alt: p.cover_image_prompt,
      tags: p.tags ?? [],
      cities: ["Imbituba"],
      is_breaking: isBreaking,
      is_exclusive: false,
      status: "published" as const,
      auto_published: true,
      published_at: p.published_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };

    if (existing) {
      const { error } = await supabase.from("articles").update(row).eq("id", existing.id);
      if (error) {
        console.error(`  ✗ update ${p.slug} — ${error.message}`);
        failed++;
      } else {
        updated++;
        links.push({ articleId: existing.id, slug: p.slug, draftId: p.draft_id });
      }
    } else {
      const { data: created, error } = await supabase
        .from("articles")
        .insert(row)
        .select("id")
        .single<{ id: string }>();
      if (error || !created) {
        console.error(`  ✗ insert ${p.slug} — ${error?.message ?? "no row returned"}`);
        failed++;
      } else {
        inserted++;
        console.log(`  + ${p.slug}`);
        links.push({ articleId: created.id, slug: p.slug, draftId: p.draft_id });
      }
    }
  }

  console.log(`\n  articles: +${inserted} inseridas · ~${updated} atualizadas · ${failed} falharam`);
  return links;
}

// ---- sync social_posts (Instagram drafts) ----------------------------------
async function syncSocialPosts(supabase: SupabaseClient, links: ArticleLink[]) {
  console.log("\n→ /drafts/published + /drafts/pending (BOMBEI)");
  const [published, pending] = await Promise.all([
    bombei<BombeiDraft[]>("/drafts/published"),
    bombei<BombeiDraft[]>("/drafts/pending"),
  ]);
  const drafts = new Map<string, BombeiDraft>();
  for (const d of [...published, ...pending]) {
    drafts.set(d.draft_id, d);
  }
  console.log(`  ${drafts.size} drafts no BOMBEI (${published.length} publicados, ${pending.length} pendentes)`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const link of links) {
    if (!link.draftId) {
      skipped++;
      continue;
    }
    const draft = drafts.get(link.draftId);
    if (!draft) {
      console.log(`  ⊘ ${link.slug} — draft ${link.draftId} não achado no BOMBEI`);
      skipped++;
      continue;
    }

    // 1 article = 1 instagram_feed post (canal único por enquanto).
    const isPublished = !!draft.published_at;
    // Postgres rejeita NULL byte (\x00) em text/jsonb — strip.
    const stripNull = (s: string) => s.replace(/\x00/g, "");
    const row = {
      article_id: link.articleId,
      channel: "instagram_feed" as const,
      format: "card_1080" as const,
      caption: stripNull(draft.caption),
      hashtags: (draft.hashtags ?? []).map(stripNull),
      status: isPublished ? ("published" as const) : ("ready" as const),
      published_at: draft.published_at ?? null,
      external_url: draft.instagram_permalink ?? null,
      external_id: draft.draft_id,
    };

    // Idempotente: chave natural = (article_id, channel) — só 1 IG feed por artigo.
    const { data: existing } = await supabase
      .from("social_posts")
      .select("id")
      .eq("article_id", link.articleId)
      .eq("channel", "instagram_feed")
      .maybeSingle<{ id: string }>();

    if (existing) {
      const { error } = await supabase.from("social_posts").update(row).eq("id", existing.id);
      if (error) {
        console.error(`  ✗ update social ${link.slug} — ${error.message}`);
        failed++;
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("social_posts").insert(row);
      if (error) {
        console.error(`  ✗ insert social ${link.slug} — ${error.message}`);
        failed++;
      } else {
        inserted++;
        console.log(`  + ${link.slug} [IG]`);
      }
    }
  }

  console.log(
    `\n  social_posts: +${inserted} inseridos · ~${updated} atualizados · ${skipped} pulados · ${failed} falharam`,
  );
}

// ---- main ------------------------------------------------------------------
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Healthcheck do BOMBEI
  try {
    await bombei<{ status: string }>("/health");
  } catch (e) {
    console.error(`BOMBEI offline em ${BOMBEI} — sobe com 'make up' no radar-regional antigo. (${e})`);
    process.exit(1);
  }

  const links = await syncArticles(supabase);
  await syncSocialPosts(supabase, links);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
