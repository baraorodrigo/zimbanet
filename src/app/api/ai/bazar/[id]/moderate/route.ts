import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/ai/bazar/{id}/moderate  { decision: "approve" | "reject" }
export const POST = withAgent(
  { tool: "moderate_bazar", action: "write", resource: "bazar" },
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
      .from("bazar_items")
      .update({ status: decision === "approve" ? "active" : "removed" })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "item não encontrado" }, { status: 404 });
    await sb.from("audit_log").insert({
      entity_type: "bazar_item",
      entity_id: id,
      action: `moderate_${decision}`,
      actor: agent.id,
      agent: "hermes",
      metadata: {},
    });
    return NextResponse.json({ ok: true, data });
  },
);
