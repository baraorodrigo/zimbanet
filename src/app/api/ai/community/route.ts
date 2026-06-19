import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/ai/community?moderation_status=pending&limit=50
// Lista posts do mural (#zimbamilgrau) pra moderação.
export const GET = withAgent(
  { tool: "list_mural", action: "read", resource: "community" },
  async (req) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("moderation_status") ?? "pending";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("mural_posts")
      .select("id, author_name, bairro, body, status, moderation_status, created_at")
      .eq("moderation_status", status)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  },
);
