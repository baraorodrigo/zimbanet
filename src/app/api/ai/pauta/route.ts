import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ScoredRow = {
  id: string;
  raw_item_id: string | null;
  relevance_score: number | null;
  classification: string | null;
  editoria: string | null;
  ai_reasoning: string | null;
  scored_at: string | null;
};

type RawRow = {
  id: string;
  title: string | null;
  url: string | null;
  image_url: string | null;
  published_at: string | null;
};

// GET /api/ai/pauta?decision=investigate&limit=20
// Lista as pautas pro agente trabalhar. Default = as "pra investigar" (decision
// 'investigate'). Junta título/url/imagem do raw_item e marca quais já viraram
// matéria (ja_tem_materia) pra ele não retrabalhar o que já está feito.
export const GET = withAgent(
  { tool: "list_pauta", action: "read", resource: "pauta" },
  async (req) => {
    const url = new URL(req.url);
    const decision = (url.searchParams.get("decision") || "investigate").toLowerCase();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);
    // Default editorial: pauta dos últimos 3 dias (alinhado à trava de publicação
    // por idade). Compara idade, não dia do calendário. ?dias=N abre/fecha a janela.
    const dias = Math.min(Math.max(Number(url.searchParams.get("dias") ?? 3), 1), 60);
    const sb = createAdminClient();

    // over-fetch: a filtragem por recência + "já tem matéria" é em JS, então
    // puxamos mais candidatas pra sobrar o suficiente depois do filtro.
    const fetchCap = Math.min(200, Math.max(limit * 6, 60));
    const { data: scoredData, error } = await sb
      .from("scored_items")
      .select("id, raw_item_id, relevance_score, classification, editoria, ai_reasoning, scored_at")
      .eq("decision", decision)
      .order("relevance_score", { ascending: false })
      .order("scored_at", { ascending: false })
      .limit(fetchCap);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const scored = (scoredData ?? []) as ScoredRow[];
    const rawIds = scored.map((s) => s.raw_item_id).filter((x): x is string => Boolean(x));
    const scoredIds = scored.map((s) => s.id);

    const [rawsRes, artsRes] = await Promise.all([
      rawIds.length
        ? sb.from("raw_items").select("id, title, url, image_url, published_at").in("id", rawIds)
        : Promise.resolve({ data: [] as RawRow[] }),
      scoredIds.length
        ? sb.from("articles").select("scored_item_id").in("scored_item_id", scoredIds)
        : Promise.resolve({ data: [] as { scored_item_id: string }[] }),
    ]);

    const rawById = new Map(((rawsRes.data ?? []) as RawRow[]).map((r) => [r.id, r]));
    const jaTemMateria = new Set(
      ((artsRes.data ?? []) as { scored_item_id: string }[]).map((a) => a.scored_item_id),
    );

    const items = scored.map((s) => {
      const raw = (s.raw_item_id ? rawById.get(s.raw_item_id) : undefined) ?? null;
      return {
        scored_item_id: s.id,
        titulo: raw?.title ?? null,
        url: raw?.url ?? null,
        imagem: raw?.image_url ?? null,
        publicado_fonte: raw?.published_at ?? null,
        relevancia: s.relevance_score,
        classificacao: s.classification,
        editoria: s.editoria,
        motivo: s.ai_reasoning,
        ja_tem_materia: jaTemMateria.has(s.id),
      };
    });

    // Só pautas ACIONÁVEIS: recentes e que ainda não viraram matéria.
    // Default = HOJE no fuso editorial; com ?dias=N dá pra abrir a janela.
    // Sem data entra, porque não dá pra afirmar que é velha.
    const cutoff = Date.now() - dias * 86_400_000;
    const acionaveis = items
      .filter((it) => !it.ja_tem_materia)
      .filter((it) => {
        if (!it.publicado_fonte) return true;
        return new Date(it.publicado_fonte).getTime() >= cutoff;
      })
      .sort((a, b) => {
        const ta = a.publicado_fonte ? new Date(a.publicado_fonte).getTime() : 0;
        const tb = b.publicado_fonte ? new Date(b.publicado_fonte).getTime() : 0;
        return tb - ta;
      })
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      data: { decision, dias, total: acionaveis.length, items: acionaveis },
    });
  },
);
