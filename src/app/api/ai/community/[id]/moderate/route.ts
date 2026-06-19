import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/ai/community/{id}/moderate  { decision: "approve" | "reject" }
export const POST = withAgent(
  { tool: "moderate_mural", action: "write", resource: "community" },
  async (req, { agent }, route) => {
    const id = route.params.id;
    const body = (await req.json().catch(() => ({}))) as { decision?: string };
    const decision = body.decision;
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json(
        { ok: false, error: "decision deve ser 'approve' ou 'reject'" },
        { status: 400 },
      );
    }
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("mural_posts")
      .update({
        moderation_status: decision === "approve" ? "approved" : "rejected",
        status: decision === "approve" ? "published" : "removed",
      })
      .eq("id", id)
      .select("id, moderation_status, status")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "post não encontrado" }, { status: 404 });
    await sb.from("audit_log").insert({
      entity_type: "mural_post",
      entity_id: id,
      action: `moderate_${decision}`,
      actor: agent.id,
      agent: "hermes",
      metadata: {},
    });
    return NextResponse.json({ ok: true, data });
  },
);
