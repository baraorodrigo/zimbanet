import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/ai/pendencias → o que precisa de atenção do agente AGORA.
// Resumo de tarefas: rascunhos, em revisão, mural/bazar pra moderar, pautas frescas.
export const GET = withAgent(
  { tool: "pendencias", action: "read", resource: "pendencias" },
  async () => {
    const sb = createAdminClient();
    const head = { count: "exact" as const, head: true };
    const doisDiasAtras = new Date(Date.now() - 2 * 86_400_000).toISOString();

    const [drafts, review, mural, bazar, pautaFresca] = await Promise.all([
      sb.from("articles").select("id", head).eq("status", "draft"),
      sb.from("articles").select("id", head).eq("status", "review"),
      sb.from("mural_posts").select("id", head).eq("moderation_status", "pending"),
      sb.from("bazar_items").select("id", head).eq("status", "pending"),
      sb
        .from("scored_items")
        .select("id", head)
        .in("decision", ["approve", "investigate"])
        .gte("scored_at", doisDiasAtras),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        rascunhos: drafts.count ?? 0,
        em_revisao: review.count ?? 0,
        mural_pra_moderar: mural.count ?? 0,
        bazar_pra_moderar: bazar.count ?? 0,
        pautas_frescas: pautaFresca.count ?? 0,
      },
    });
  },
);
