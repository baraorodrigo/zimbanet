import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/ai/articles/{id}/home  { cover?, highlight?, breaking? }
// Controla a vitrine da home: capa (única), destaque e barra de urgente.
// Só matéria PUBLICADA. Cada flag é opcional — aplica só o que vier no body.
export const POST = withAgent(
  { tool: "home_flags", action: "write", resource: "homepage" },
  async (req, { agent }, route) => {
    const id = route.params.id;
    const body = (await req.json().catch(() => ({}))) as {
      cover?: boolean;
      highlight?: boolean;
      breaking?: boolean;
    };

    const sb = createAdminClient();
    const { data: cur } = await sb
      .from("articles")
      .select("status, slug, editoria, is_cover, is_highlight, is_breaking")
      .eq("id", id)
      .maybeSingle();
    if (!cur) return NextResponse.json({ ok: false, error: "matéria não encontrada" }, { status: 404 });
    if (cur.status !== "published") {
      return NextResponse.json(
        { ok: false, error: `só matéria publicada vai pra vitrine da home (status: ${cur.status})` },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };

    if (typeof body.cover === "boolean") {
      // Capa é única: ao fixar uma, limpa a anterior.
      if (body.cover) {
        await sb
          .from("articles")
          .update({ is_cover: false, updated_at: now })
          .eq("is_cover", true)
          .neq("id", id);
      }
      patch.is_cover = body.cover;
    }
    if (typeof body.highlight === "boolean") patch.is_highlight = body.highlight;
    if (typeof body.breaking === "boolean") patch.is_breaking = body.breaking;

    const { data, error } = await sb
      .from("articles")
      .update(patch)
      .eq("id", id)
      .select("id, slug, editoria, is_cover, is_highlight, is_breaking")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await sb.from("audit_log").insert({
      entity_type: "article",
      entity_id: id,
      action: "agent_home_flags",
      actor: agent.id,
      agent: "hermes",
      metadata: { cover: body.cover, highlight: body.highlight, breaking: body.breaking },
    });

    revalidatePath("/", "layout");
    if (cur.editoria) {
      revalidatePath(`/${cur.editoria}`);
      if (cur.slug) revalidatePath(`/${cur.editoria}/${cur.slug}`);
    }

    return NextResponse.json({ ok: true, data });
  },
);
