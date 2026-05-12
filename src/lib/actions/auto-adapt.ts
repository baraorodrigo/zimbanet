"use server";

// Auto-adapt de captions multi-canal.
// Pega a caption de um social_post e adapta pros outros canais do pacote
// (mesmo article) usando Claude Haiku (rápido + barato).
//
// Regras de tom por canal:
//   instagram_feed/carousel/story  ->  visual, hashtags ao final, ~180 chars
//   facebook                       ->  conversacional, link no final, ~600 chars
//   whatsapp                       ->  direto, sem hashtags, com CTA, ~280 chars
//   telegram                       ->  informativo, parecido com WA mas mais formal
//   push                           ->  TÍTULO em caps + 1 frase curta, ~120 chars

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/auth/admin";
import { generateText } from "@/lib/ai/text";

// Modelo agora vem do slot "text_fast" configurado no /admin/configuracoes.

const CHANNEL_BRIEF: Record<string, string> = {
  instagram_feed:
    "Instagram feed: tom visual e direto, hashtags só no final, ~180 chars úteis antes do 'mais'.",
  instagram_story:
    "Instagram stories: 1-2 linhas curtas, energia, sem hashtags pesadas, ~120 chars.",
  instagram_carousel:
    "Instagram carrossel: gancho na primeira linha, ~200 chars, sem repetir headline da arte.",
  facebook:
    "Facebook: conversacional, ~3 frases (~600 chars), encerra com chamada pro link na bio.",
  whatsapp:
    "WhatsApp Status/lista: super direto, ~280 chars, sem hashtags, encerra com 'Confira na ZIMBANET' ou similar.",
  telegram:
    "Telegram: informativo, formal-acessível, ~320 chars, pode ter hashtag única editorial (#cidade #policia etc).",
  push:
    "Push notification: TÍTULO CURTO EM CAIXA ALTA + 1 frase de subtítulo. Total ~120 chars. Sem emojis pesados.",
};

type AdaptResult = {
  adapted: Array<{
    socialPostId: string;
    channel: string;
    caption: string;
  }>;
};

// ----------------------------------------------------------------
// Adapta a caption de um post pra todos os outros canais do mesmo
// article (skip published/failed). Atualiza social_posts.caption em
// massa. Retorna o que foi alterado pro UI mostrar o diff.
// ----------------------------------------------------------------
export async function autoAdaptCaptionsToAllChannels(
  sourceSocialPostId: string,
): Promise<AdaptResult> {
  if (!sourceSocialPostId) throw new Error("socialPostId ausente.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  // Lê o post fonte + irmãos do mesmo article
  const { data: sourceRaw } = await supabase
    .from("social_posts")
    .select("id, article_id, channel, caption, hashtags")
    .eq("id", sourceSocialPostId)
    .maybeSingle();
  const source = (sourceRaw ?? null) as {
    id: string;
    article_id: string;
    channel: string;
    caption: string | null;
    hashtags: string[] | null;
  } | null;
  if (!source) throw new Error("Post fonte não encontrado.");
  if (!source.caption?.trim()) {
    throw new Error("Post fonte está sem caption — escreva primeiro.");
  }

  const { data: siblingsRaw } = await supabase
    .from("social_posts")
    .select("id, channel, status")
    .eq("article_id", source.article_id)
    .neq("id", source.id)
    .neq("status", "published")
    .neq("status", "failed");
  const siblings = (siblingsRaw ?? []) as Array<{
    id: string;
    channel: string;
    status: string;
  }>;

  if (!siblings.length) {
    return { adapted: [] };
  }

  // Lê título/editoria pra dar contexto extra ao Claude
  const { data: articleRaw } = await supabase
    .from("articles")
    .select("title, editoria, kicker")
    .eq("id", source.article_id)
    .maybeSingle();
  const article = (articleRaw ?? null) as {
    title: string;
    editoria: string;
    kicker: string | null;
  } | null;

  const targetsList = siblings
    .map((s) => `- ${s.channel}: ${CHANNEL_BRIEF[s.channel] ?? "tom adequado ao canal"}`)
    .join("\n");

  const system = `Você é o redator-distribuidor da ZIMBANET, portal de Imbituba/SC.
Recebe a caption original (canal "${source.channel}") e adapta para outros canais sociais
mantendo o significado e respeitando o tom + tamanho de cada canal.

Regras absolutas:
- PT-BR brasileiro, tom regional acolhedor mas profissional.
- Nunca invente fatos novos — só adapte o que já está na caption original.
- Mantenha menções a pessoas/lugares/cidades exatamente como aparecem.
- Não use emojis em push/whatsapp; permita 1 emoji moderado em IG/FB.
- Hashtags: copie do original quando o canal aceitar (IG/Telegram).
- Devolva APENAS um JSON válido no formato:
  {"adaptations":[{"channel":"<canal>","caption":"<texto adaptado>"}, ...]}
- Sem markdown, sem comentários, sem texto antes ou depois do JSON.`;

  const userMessage = `Matéria: "${article?.title ?? ""}"
Editoria: ${article?.editoria ?? "—"}
${article?.kicker ? `Kicker: ${article.kicker}` : ""}

CAPTION ORIGINAL (canal ${source.channel}):
"""
${source.caption}
"""

Hashtags originais: ${(source.hashtags ?? []).join(" ") || "(nenhuma)"}

Adapte para os seguintes canais, respeitando a especificação de cada um:
${targetsList}

Lembre: devolva apenas o JSON {"adaptations":[...]}.`;

  const t0 = Date.now();
  const resp = await generateText({
    slot: "text_fast",
    system,
    messages: [{ role: "user", content: userMessage }],
    temperature: 0.4,
    max_tokens: 2000,
  });
  const elapsedMs = Date.now() - t0;

  // Parse defensivo — se Claude pisar na bola e mandar markdown, tenta salvar
  let parsed: { adaptations?: Array<{ channel: string; caption: string }> };
  try {
    const txt = resp.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    parsed = JSON.parse(txt);
  } catch {
    throw new Error(
      "Resposta da IA veio em formato inesperado — tenta de novo.",
    );
  }

  const adaptations = Array.isArray(parsed?.adaptations) ? parsed.adaptations : [];
  if (!adaptations.length) {
    throw new Error("IA não devolveu adaptações.");
  }

  // Aplica via admin client (bypassa RLS pro admin staff)
  const admin = createAdminClient();
  const adapted: AdaptResult["adapted"] = [];

  for (const sib of siblings) {
    const match = adaptations.find((a) => a.channel === sib.channel);
    if (!match || typeof match.caption !== "string") continue;
    const caption = match.caption.trim().slice(0, 2200);
    if (!caption) continue;

    const { error } = await admin
      .from("social_posts")
      .update({
        caption,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sib.id);
    if (error) continue;

    adapted.push({ socialPostId: sib.id, channel: sib.channel, caption });
  }

  await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: source.id,
    action: "auto_adapt_captions",
    actor: user!.email ?? user!.id,
    agent: "admin_ui_estudio_adapter",
    model: `${resp.provider}:${resp.modelId}`,
    tokens_in: resp.usage.input_tokens,
    tokens_out: resp.usage.output_tokens,
    metadata: {
      article_id: source.article_id,
      source_channel: source.channel,
      target_channels: siblings.map((s) => s.channel),
      adapted_count: adapted.length,
      elapsed_ms: elapsedMs,
    },
  });

  revalidatePath(`/admin/estudio/${source.article_id}`);
  revalidatePath("/admin/social");

  return { adapted };
}
