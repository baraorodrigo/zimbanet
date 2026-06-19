import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/ai/articles/{id}/unpublish  → tira do ar (volta a rascunho) pra o
// agente CORRIGIR e republicar. Só funciona em publicada.
export const POST = withAgent(
  { tool: "unpublish_article", action: "write", resource: "publish" },
  async (_req, { agent }, route) => {
    const id = route.params.id;
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("articles")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "published")
      .select("id, slug, editoria, status")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "matéria não encontrada ou não estava publicada" },
        { status: 404 },
      );
    }
    await sb.from("audit_log").insert({
      entity_type: "article",
      entity_id: id,
      action: "agent_unpublish",
      actor: agent.id,
      agent: "hermes",
      metadata: { slug: data.slug },
    });
    return NextResponse.json({ ok: true, data });
  },
);
