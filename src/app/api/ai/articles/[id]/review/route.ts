import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/ai/articles/{id}/review  → manda o rascunho pra revisão humana.
// É o MÁXIMO que um agente faz — publicar continua só humano no admin.
export const POST = withAgent(
  { tool: "submit_review", action: "write", resource: "article_content" },
  async (_req, _ctx, route) => {
    const id = route.params.id;
    const sb = createAdminClient();
    const { data: cur } = await sb.from("articles").select("status").eq("id", id).maybeSingle();
    if (!cur) return NextResponse.json({ ok: false, error: "matéria não encontrada" }, { status: 404 });
    if (cur.status !== "draft") {
      return NextResponse.json(
        { ok: false, error: `só rascunho vai pra revisão (status: ${cur.status})` },
        { status: 409 },
      );
    }
    const { error } = await sb
      .from("articles")
      .update({ status: "review", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: { id, status: "review" } });
  },
);
