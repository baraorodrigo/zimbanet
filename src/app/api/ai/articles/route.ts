import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIST_FIELDS, CONTENT_FIELDS, pickFields } from "@/lib/ai/articles";
import { uniqueArticleSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

// Editorias válidas (CHECK constraint da tabela articles).
const EDITORIAS = [
  "cidade", "politica", "esporte", "cultura", "policia", "praias", "economia", "opiniao",
];

// Campos opcionais que o agente pode setar ao CRIAR (além de title/body obrigatórios).
// NÃO inclui status (forçado draft) nem is_breaking (decisão humana no publish).
const CREATE_OPTIONAL = [...CONTENT_FIELDS, "hero_image_url", "hero_image_alt", "source_url"];

function asArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return undefined;
}

// GET /api/ai/articles?status=draft&limit=50&q=texto  → lista/busca matérias.
// q (opcional) filtra por palavra no título/lede — pra ACHAR uma matéria.
export const GET = withAgent(
  { tool: "list_articles", action: "read", resource: "articles" },
  async (req) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "draft";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const q = (url.searchParams.get("q") ?? "").trim();
    const sb = createAdminClient();
    let query = sb
      .from("articles")
      .select(LIST_FIELDS)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (q) {
      const p = `%${q.replace(/[%_]/g, "\\$&")}%`;
      query = query.or(`title.ilike.${p},lede.ilike.${p}`);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  },
);

// POST /api/ai/articles  → cria RASCUNHO (status=draft SEMPRE; nunca publica).
export const POST = withAgent(
  { tool: "create_article", action: "write", resource: "article_content" },
  async (req, { agent }) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const title = String(body.title ?? "").trim();
    const articleBody = String(body.body ?? "").trim();
    if (title.length < 6) {
      return NextResponse.json({ ok: false, error: "title obrigatório (mín 6 caracteres)" }, { status: 400 });
    }
    if (articleBody.length < 50) {
      return NextResponse.json({ ok: false, error: "body obrigatório (mín 50 caracteres)" }, { status: 400 });
    }

    // editoria: aceita 'editoria' ou alias 'editorial'; valida; default 'cidade'.
    const rawEd = String(body.editoria ?? body.editorial ?? "").trim().toLowerCase();
    const editoria = EDITORIAS.includes(rawEd) ? rawEd : "cidade";

    const sb = createAdminClient();
    const slug = await uniqueArticleSlug(sb, String(body.slug ?? "").trim() || title);

    const patch = pickFields(body, CREATE_OPTIONAL);
    // alias featured_image -> hero_image_url
    if (body.featured_image && !patch.hero_image_url) patch.hero_image_url = body.featured_image;
    // arrays text[]
    const tags = asArray(body.tags);
    const cities = asArray(body.cities);
    if (tags) patch.tags = tags;
    if (cities) patch.cities = cities;

    const insert = {
      ...patch,
      title,
      body: articleBody,
      slug,
      editoria,
      byline: (patch.byline as string) || "ZIMBANET",
      status: "draft", // FORÇADO — agente NUNCA publica
    };

    const { data, error } = await sb
      .from("articles")
      .insert(insert)
      .select("id, slug, status, editoria, title")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await sb.from("audit_log").insert({
      entity_type: "article",
      entity_id: data.id,
      action: "agent_create_article",
      actor: agent.id,
      agent: "hermes",
      metadata: { slug: data.slug, editoria: data.editoria },
    });

    return NextResponse.json({ ok: true, data });
  },
);
