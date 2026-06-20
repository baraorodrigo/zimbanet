import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/ai/articles/{id}/archive → ARQUIVA a matéria (aposenta do acervo).
// Diferente de despublicar (que volta a rascunho pra corrigir): archive tira do
// ar de vez (fica guardada, recuperável). Usado pra limpar notícia velha/ruim.
export const POST = withAgent(
  { tool: "archive_article", action: "write", resource: "publish" },
  async (_req, { agent }, route) => {
    const id = route.params.id;
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("articles")
      .update({
        status: "archived",
        is_cover: false,
        is_highlight: false,
        is_breaking: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .in("status", ["published", "draft", "review", "scheduled"])
      .select("id, slug, editoria, status")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "matéria não encontrada ou já arquivada" },
        { status: 404 },
      );
    }

    await sb.from("audit_log").insert({
      entity_type: "article",
      entity_id: id,
      action: "agent_archive",
      actor: agent.id,
      agent: "hermes",
      metadata: { slug: data.slug },
    });

    revalidatePath("/", "layout");
    if (data.editoria) revalidatePath(`/${data.editoria}`);

    return NextResponse.json({ ok: true, data });
  },
);
