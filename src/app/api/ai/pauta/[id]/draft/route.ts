import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftFromScored } from "@/lib/radar";
import { downloadAndStoreImage } from "@/lib/storage-images";
import { sourceIsFromTodayByScoredId } from "@/lib/ai/recency";

export const dynamic = "force-dynamic";

// POST /api/ai/pauta/{scored_item_id}/draft
// Transforma a pauta em rascunho: roda Investigador → Redator no radar e cria a
// matéria (status draft). Aceita pauta aprovada OU em investigação — o radar só
// bloqueia (422) item rejeitado. Best-effort: se o rascunho não veio com foto,
// usa a imagem da fonte (raw_item.image_url) pra já passar na trava de publicação.
// NÃO publica — o agente revisa, ajusta e chama publicar depois.
export const POST = withAgent(
  { tool: "trabalhar_pauta", action: "write", resource: "radar" },
  async (_req, { agent }, route) => {
    const scoredId = route.params.id;
    const sb = createAdminClient();

    // TRAVA NOTÍCIA VELHA: pauta só vira matéria se a fonte for de HOJE no
    // fuso editorial do portal. Se é de ontem, já não entra como notícia nova.
    const sourceIsToday = await sourceIsFromTodayByScoredId(sb, scoredId);
    if (sourceIsToday === false) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "pauta antiga: a fonte não é de hoje. Se o fato não aconteceu hoje, não vale virar notícia nova no portal.",
        },
        { status: 422 },
      );
    }

    let res: Awaited<ReturnType<typeof draftFromScored>>;
    try {
      res = await draftFromScored(scoredId);
    } catch (e) {
      const msg = (e as Error).message;
      const status = /\b422\b/.test(msg) ? 422 : 502;
      return NextResponse.json({ ok: false, error: msg }, { status });
    }

    // Best-effort: garante foto de capa a partir da imagem da fonte.
    let fotoDefinida = false;
    try {
      const { data: art } = await sb
        .from("articles")
        .select("hero_image_url, slug")
        .eq("id", res.article_id)
        .maybeSingle();
      if (art?.hero_image_url && String(art.hero_image_url).trim()) {
        fotoDefinida = true;
      } else if (art) {
        const { data: sc } = await sb
          .from("scored_items")
          .select("raw_item_id")
          .eq("id", scoredId)
          .maybeSingle();
        const rawId = sc?.raw_item_id;
        if (rawId) {
          const { data: raw } = await sb
            .from("raw_items")
            .select("image_url")
            .eq("id", rawId)
            .maybeSingle();
          const imageUrl = (raw?.image_url ?? "").trim();
          if (/^https?:\/\//i.test(imageUrl)) {
            const hosted = await downloadAndStoreImage(imageUrl, `hero/${art.slug || res.article_id}`);
            await sb
              .from("articles")
              .update({ hero_image_url: hosted, updated_at: new Date().toISOString() })
              .eq("id", res.article_id);
            fotoDefinida = true;
          }
        }
      }
    } catch {
      // sem foto: o agente define com definir_imagem antes de publicar
    }

    await sb.from("audit_log").insert({
      entity_type: "article",
      entity_id: res.article_id,
      action: "agent_draft_pauta",
      actor: agent.id,
      agent: "hermes",
      metadata: { scored_item_id: scoredId, slug: res.slug, reused: res.reused },
    });

    return NextResponse.json({ ok: true, data: { ...res, foto_definida: fotoDefinida } });
  },
);
