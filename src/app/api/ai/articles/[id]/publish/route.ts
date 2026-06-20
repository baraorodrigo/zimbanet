import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeArticle } from "@/lib/radar";
import { MAX_SOURCE_AGE_DAYS, sourceAgeDaysByScoredId } from "@/lib/ai/recency";

export const dynamic = "force-dynamic";

// POST /api/ai/articles/{id}/publish  → AGENTE PUBLICA a matéria.
// ATENÇÃO: reverte a regra antiga "agente nunca publica" (fase de teste,
// autonomia total). Trava de segurança: interruptor mestre em app_settings
// (agent_autopublish_enabled). Humano para tudo revogando o token em
// /admin/agentes, ou despublica 1 a 1 na matéria.
export const POST = withAgent(
  { tool: "publish_article", action: "write", resource: "publish" },
  async (_req, { agent }, route) => {
    const id = route.params.id;
    const sb = createAdminClient();

    // Interruptor mestre: se desligado, o agente não publica.
    const { data: flag } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "agent_autopublish_enabled")
      .maybeSingle();
    if (flag && String(flag.value).toLowerCase() === "false") {
      return NextResponse.json(
        { ok: false, error: "autopublish desligado pelo humano (app_settings)" },
        { status: 423 },
      );
    }

    const { data: cur } = await sb
      .from("articles")
      .select("status, source_url, scored_item_id, hero_image_url")
      .eq("id", id)
      .maybeSingle();
    if (!cur) return NextResponse.json({ ok: false, error: "matéria não encontrada" }, { status: 404 });
    if (!["draft", "review", "scheduled"].includes(cur.status)) {
      return NextResponse.json(
        { ok: false, error: `só rascunho/revisão/agendada publica (status: ${cur.status})` },
        { status: 409 },
      );
    }

    // TRAVA ANTI-NOTÍCIA-VELHA: o agente não publica matéria sem origem
    // rastreável. Toda matéria precisa vir de uma reportagem real e atual —
    // ou foi raspada pelo radar (tem scored_item_id) ou tem uma fonte (source_url).
    // Sem isso, é texto escrito "de cabeça" (risco de fato antigo/inventado).
    const hasSource =
      Boolean(cur.scored_item_id) ||
      Boolean(cur.source_url && String(cur.source_url).trim());
    if (!hasSource) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "matéria sem fonte rastreável não publica. Toda matéria precisa vir de uma reportagem REAL e ATUAL: use submit_url_to_radar (você acha a URL, o radar raspa) ou anexe a fonte antes de publicar. NUNCA escreva de memória.",
        },
        { status: 422 },
      );
    }

    // TRAVA SEM FOTO: matéria sem imagem de capa não publica.
    if (!cur.hero_image_url || !String(cur.hero_image_url).trim()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "matéria sem foto não publica. Defina a imagem de capa com definir_imagem (passe a URL de uma foto real da reportagem) antes de publicar.",
        },
        { status: 422 },
      );
    }

    // TRAVA NOTÍCIA VELHA: fonte mais velha que o limite não publica como notícia.
    const ageDays = await sourceAgeDaysByScoredId(sb, cur.scored_item_id);
    if (ageDays !== null && ageDays > MAX_SOURCE_AGE_DAYS) {
      return NextResponse.json(
        {
          ok: false,
          error: `matéria de fato antigo não publica como notícia: a fonte é de ${Math.round(ageDays)} dias atrás (limite ${MAX_SOURCE_AGE_DAYS}). Notícia é fato RECENTE — trabalhe uma pauta atual.`,
        },
        { status: 422 },
      );
    }

    const { data, error } = await sb
      .from("articles")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        auto_published: true,
      })
      .eq("id", id)
      .select("id, slug, editoria, status")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "falha ao publicar" }, { status: 500 });

    await sb.from("audit_log").insert({
      entity_type: "article",
      entity_id: id,
      action: "agent_publish",
      actor: agent.id,
      agent: "hermes",
      metadata: { slug: data.slug, editoria: data.editoria },
    });

    // Visual + Distribuidor (social) em background — não bloqueia.
    finalizeArticle(id).catch((e: Error) =>
      console.warn("[agent publish] finalize falhou:", e.message),
    );

    // Atualiza a home na hora (sem isso a matéria do agente ficava presa no
    // cache ISR de 60s e não subia pra capa/destaques). Espelha o publish humano.
    revalidatePath("/", "layout");
    revalidatePath(`/${data.editoria}`);
    revalidatePath(`/${data.editoria}/${data.slug}`);

    return NextResponse.json({ ok: true, data });
  },
);
