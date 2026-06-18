import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { EDITABLE_STATUSES } from "@/lib/ai/articles";
import { downloadAndStoreImage } from "@/lib/storage-images";

export const dynamic = "force-dynamic";

// POST /api/ai/articles/{id}/hero  { image_url, alt? }
// Baixa a imagem da URL, guarda no Storage do ZIMBANET (sem hotlink) e define
// como hero do RASCUNHO. Só rascunho/revisão — nunca toca matéria publicada.
export const POST = withAgent(
  { tool: "set_hero", action: "write", resource: "article_content" },
  async (req, { agent }, route) => {
    const id = route.params.id;
    const body = (await req.json().catch(() => ({}))) as { image_url?: string; alt?: string };
    const imageUrl = (body.image_url ?? "").trim();
    if (!/^https?:\/\//i.test(imageUrl)) {
      return NextResponse.json({ ok: false, error: "image_url inválida (http/https)" }, { status: 400 });
    }

    const sb = createAdminClient();
    const { data: cur } = await sb
      .from("articles")
      .select("status, slug")
      .eq("id", id)
      .maybeSingle();
    if (!cur) return NextResponse.json({ ok: false, error: "matéria não encontrada" }, { status: 404 });
    if (!EDITABLE_STATUSES.includes(cur.status)) {
      return NextResponse.json(
        { ok: false, error: `só rascunho/revisão pode receber imagem (status: ${cur.status})` },
        { status: 409 },
      );
    }

    let hosted: string;
    try {
      hosted = await downloadAndStoreImage(imageUrl, `hero/${cur.slug || id}`);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: `falha ao baixar/guardar imagem: ${(e as Error).message}` },
        { status: 422 },
      );
    }

    const patch: Record<string, unknown> = {
      hero_image_url: hosted,
      updated_at: new Date().toISOString(),
    };
    if (typeof body.alt === "string" && body.alt.trim()) {
      patch.hero_image_alt = body.alt.trim().slice(0, 500);
    }

    const { data, error } = await sb
      .from("articles")
      .update(patch)
      .eq("id", id)
      .select("id, hero_image_url")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await sb.from("audit_log").insert({
      entity_type: "article",
      entity_id: id,
      action: "agent_set_hero",
      actor: agent.id,
      agent: "hermes",
      metadata: { source: imageUrl, hosted },
    });

    return NextResponse.json({ ok: true, data });
  },
);
