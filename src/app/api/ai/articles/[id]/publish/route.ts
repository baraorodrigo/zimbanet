import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAgent } from "@/lib/ai/with-agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeArticle } from "@/lib/radar";
import { checkCanPublish } from "@/lib/rules/article-publish";

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
    // FAIL-CLOSED: o agente só publica se a flag existir E for 'true'. Ausente,
    // 'false', ou qualquer outro valor → bloqueia (423). Assim um banco novo/
    // restaurado, ou a flag apagada, NÃO solta publicação autônoma sem ninguém
    // ligar. A migration seeda 'true' (com ON CONFLICT DO NOTHING).
    const { data: flag } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "agent_autopublish_enabled")
      .maybeSingle();
    const autopublishOn = String(flag?.value ?? "").toLowerCase() === "true";
    if (!autopublishOn) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "autopublish desligado (app_settings.agent_autopublish_enabled != 'true'). Ligue o interruptor pra o agente publicar.",
        },
        { status: 423 },
      );
    }

    const { data: cur } = await sb
      .from("articles")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (!cur) return NextResponse.json({ ok: false, error: "matéria não encontrada" }, { status: 404 });
    if (!["draft", "review", "scheduled"].includes(cur.status)) {
      return NextResponse.json(
        { ok: false, error: `só rascunho/revisão/agendada publica (status: ${cur.status})` },
        { status: 409 },
      );
    }

    // Trava única de publicação (foto+recência) + fonte rastreável (só o agente
    // exige: anti-"escrever de cabeça"). Mesma regra do painel, mais a fonte.
    const chk = await checkCanPublish(id, { requireSource: true });
    if (!chk.ok) {
      return NextResponse.json({ ok: false, error: chk.motivo }, { status: 422 });
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
