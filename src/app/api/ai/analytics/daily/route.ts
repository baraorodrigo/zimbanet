import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/ai/analytics/daily  → resumo diário (contagens do pipeline + publicação)
export const GET = withAgent(
  { tool: "analytics_daily", action: "read", resource: "analytics" },
  async () => {
    const sb = createAdminClient();
    const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD

    const [pub, drafts, appr, inv, rej, raw] = await Promise.all([
      sb.from("articles").select("id", { count: "exact", head: true }).eq("status", "published").gte("published_at", today),
      sb.from("articles").select("id", { count: "exact", head: true }).in("status", ["draft", "review"]),
      sb.from("scored_items").select("id", { count: "exact", head: true }).eq("decision", "approve"),
      sb.from("scored_items").select("id", { count: "exact", head: true }).eq("decision", "investigate"),
      sb.from("scored_items").select("id", { count: "exact", head: true }).eq("decision", "reject"),
      sb.from("raw_items").select("id", { count: "exact", head: true }).gte("fetched_at", today),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        date: today,
        published_today: pub.count ?? 0,
        drafts_pending: drafts.count ?? 0,
        pauta: { approve: appr.count ?? 0, investigate: inv.count ?? 0, reject: rej.count ?? 0 },
        raw_collected_today: raw.count ?? 0,
      },
    });
  },
);
