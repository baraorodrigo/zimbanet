import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/ai/bazar?status=pending&limit=50
// Lista classificados (#bazardazimba) pra moderação.
export const GET = withAgent(
  { tool: "list_bazar", action: "read", resource: "bazar" },
  async (req) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "pending";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("bazar_items")
      .select("id, type, category, title, description, price_label, bairro, status, created_at")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  },
);
