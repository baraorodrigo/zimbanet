import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIST_FIELDS } from "@/lib/ai/articles";

export const dynamic = "force-dynamic";

// GET /api/ai/articles?status=draft&limit=50  → lista matérias por status
export const GET = withAgent(
  { tool: "list_articles", action: "read", resource: "articles" },
  async (req) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "draft";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("articles")
      .select(LIST_FIELDS)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  },
);
