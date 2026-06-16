import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { EDITABLE_STATUSES, pickFields, SEO_FIELDS } from "@/lib/ai/articles";

export const dynamic = "force-dynamic";

// POST /api/ai/articles/{id}/seo  → edita slug/tags do rascunho (escopo SEO)
export const POST = withAgent(
  { tool: "update_seo", action: "write", resource: "slug" },
  async (req, _ctx, route) => {
    const id = route.params.id;
    const sb = createAdminClient();
    const { data: cur } = await sb.from("articles").select("status").eq("id", id).maybeSingle();
    if (!cur) return NextResponse.json({ ok: false, error: "matéria não encontrada" }, { status: 404 });
    if (!EDITABLE_STATUSES.includes(cur.status)) {
      return NextResponse.json(
        { ok: false, error: `só rascunho/revisão pode ser editado (status: ${cur.status})` },
        { status: 409 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch = pickFields(body, SEO_FIELDS);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "envie slug e/ou tags" }, { status: 400 });
    }
    patch.updated_at = new Date().toISOString();
    const { data, error } = await sb
      .from("articles")
      .update(patch)
      .eq("id", id)
      .select("id, slug, tags, updated_at")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  },
);
