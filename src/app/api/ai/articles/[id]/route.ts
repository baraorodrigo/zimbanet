import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { FULL_FIELDS } from "@/lib/ai/articles";

export const dynamic = "force-dynamic";

// GET /api/ai/articles/{id}  → matéria completa
export const GET = withAgent(
  { tool: "get_article", action: "read", resource: "articles" },
  async (_req, _ctx, route) => {
    const id = route.params.id;
    const sb = createAdminClient();
    const { data, error } = await sb.from("articles").select(FULL_FIELDS).eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "matéria não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true, data });
  },
);
