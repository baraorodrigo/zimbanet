// REGRA ÚNICA de "pode publicar?" do ZIMBANET. Antes essa decisão (tem foto?
// tem fonte? é de hoje?) vivia espalhada e divergente em ~5 caminhos — por isso
// notícia velha/sem foto vazava pela Fila. Agora é UMA regra, usada por TODOS:
// Fila (approveArticle/publishBatch), edição (publishArticle/updateArticle) e o
// agente (/api/ai/articles/[id]/publish).
//
// NÃO cobre: status válido (transição — cada caminho checa o seu) nem o
// interruptor agent_autopublish_enabled (gate só do agente, antes desta regra).

import { createAdminClient } from "@/lib/supabase/admin";
import { sourceIsFromTodayByScoredId } from "@/lib/ai/recency";

export type PublishCheck = { ok: true } | { ok: false; motivo: string };

// Núcleo PURO e testável. sourceIsToday: true/false = data conhecida; null =
// data desconhecida (só source_url ou sem data) → passa na recência, pois não dá
// pra afirmar que é velha (foto+fonte seguem obrigatórias).
export function evaluatePublish(input: {
  heroImageUrl?: string | null;
  sourceUrl?: string | null;
  scoredItemId?: string | null;
  sourceIsToday: boolean | null;
  // SÓ o agente exige fonte rastreável (anti-"escrever de cabeça"). O staff pode
  // publicar conteúdo AUTORAL (editorial/opinião/peça própria) sem fonte externa.
  requireSource?: boolean;
}): PublishCheck {
  if (!input.heroImageUrl || !String(input.heroImageUrl).trim()) {
    return { ok: false, motivo: "matéria sem foto de capa não publica. Defina a imagem antes de publicar." };
  }
  if (input.requireSource) {
    const hasSource =
      Boolean(input.scoredItemId) ||
      Boolean(input.sourceUrl && String(input.sourceUrl).trim());
    if (!hasSource) {
      return {
        ok: false,
        motivo: "matéria sem fonte rastreável não publica (precisa vir de uma reportagem real, não escrita de cabeça).",
      };
    }
  }
  if (input.sourceIsToday === false) {
    return {
      ok: false,
      motivo: "matéria de fato antigo não publica como notícia: a fonte não é de hoje.",
    };
  }
  return { ok: true };
}

// Wrapper com banco (server-only): busca os campos da matéria + a data da fonte
// e aplica a regra. Usa admin client (leitura). NÃO publica — só decide.
// overrides.heroImageUrl: pra quando a foto está sendo definida NA MESMA ação
// que publica (ex.: updateArticle, onde a foto vem do formulário, não do banco).
export async function checkCanPublish(
  articleId: string,
  opts: { heroImageUrl?: string | null; requireSource?: boolean } = {},
  now: Date = new Date(),
): Promise<PublishCheck> {
  const sb = createAdminClient();
  const { data: a } = await sb
    .from("articles")
    .select("hero_image_url, source_url, scored_item_id")
    .eq("id", articleId)
    .maybeSingle();
  if (!a) return { ok: false, motivo: "matéria não encontrada." };
  const sourceIsToday = await sourceIsFromTodayByScoredId(
    sb,
    (a.scored_item_id as string | null | undefined) ?? null,
    now,
  );
  return evaluatePublish({
    heroImageUrl: "heroImageUrl" in opts ? opts.heroImageUrl : (a.hero_image_url as string | null),
    sourceUrl: a.source_url as string | null,
    scoredItemId: a.scored_item_id as string | null,
    sourceIsToday,
    requireSource: opts.requireSource,
  });
}
