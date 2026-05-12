// POST /api/push/breaking
// Endpoint chamado pelo motor radar (Python) após publish autônomo de uma matéria
// com is_breaking=true. Auth via header X-Internal-Token == INTERNAL_PUSH_TOKEN.
//
// Body: { article_id: uuid }
// O resto (title/lede/editoria/slug) é puxado direto do Supabase pra evitar drift.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBreakingPush } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.INTERNAL_PUSH_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "internal_token_unset" }, { status: 503 });
  }
  const got = req.headers.get("x-internal-token");
  if (got !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { article_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const articleId = body.article_id;
  if (!articleId || typeof articleId !== "string") {
    return NextResponse.json({ error: "missing_article_id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, lede, subtitle, editoria, slug, hero_image_url, is_breaking, status")
    .eq("id", articleId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "article_not_found" }, { status: 404 });
  }
  if (data.status !== "published") {
    return NextResponse.json({ error: "article_not_published" }, { status: 409 });
  }
  if (!data.is_breaking) {
    return NextResponse.json({ ok: true, skipped: "not_breaking" });
  }

  const result = await sendBreakingPush({
    id: data.id as string,
    title: data.title as string,
    lede: (data.lede as string | null) ?? null,
    subtitle: (data.subtitle as string | null) ?? null,
    editoria: data.editoria as string,
    slug: data.slug as string,
    hero_image_url: (data.hero_image_url as string | null) ?? null,
  });

  return NextResponse.json({ ok: true, ...result });
}
