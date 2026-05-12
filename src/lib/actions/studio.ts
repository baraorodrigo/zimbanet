"use server";

// Server actions exclusivas do ESTÚDIO ZIMBANET — workspace de edição
// de pacotes de social posts (Fase A). Outras fases (B/C/D) plugam aqui depois
// suas próprias mutations (slots/variations/history).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";

type SupabaseSrv = ReturnType<typeof createClient>;

async function audit(
  supabase: SupabaseSrv,
  args: {
    entity_id: string;
    action: string;
    actor: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: args.entity_id,
    action: args.action,
    actor: args.actor,
    agent: "admin_ui_estudio",
    metadata: args.metadata ?? {},
  });
}

// Descobre o article_id do social_post pra revalidar a rota correta do estúdio.
async function articleIdOf(supabase: SupabaseSrv, socialPostId: string): Promise<string | null> {
  const { data } = await supabase
    .from("social_posts")
    .select("article_id")
    .eq("id", socialPostId)
    .maybeSingle();
  return (data?.article_id as string | undefined) ?? null;
}

function revalidateStudio(articleId: string | null) {
  if (articleId) {
    revalidatePath(`/admin/estudio/${articleId}`);
  }
  revalidatePath("/admin/social");
}

// Auto-save de caption — chamado no onBlur do textarea no estúdio.
// Aceita string vazia (admin pode limpar caption); o Distribuidor não joga undefined.
export async function updateSocialCaption(id: string, caption: string): Promise<void> {
  if (!id) throw new Error("ID ausente.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  // Trim leve — preserva quebras internas (legendas multi-parágrafo são comuns).
  const cleaned = caption.replace(/\s+$/g, "");

  // Limite IG = 2200 chars. Cortamos preventivamente pra não estourar publicação depois.
  const finalCaption = cleaned.length > 2200 ? cleaned.slice(0, 2200) : cleaned;

  const { error } = await supabase
    .from("social_posts")
    .update({
      caption: finalCaption,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "edit_caption",
    actor: user!.email ?? user!.id,
    metadata: { length: finalCaption.length },
  });

  const articleId = await articleIdOf(supabase, id);
  revalidateStudio(articleId);
}

// Auto-save de hashtags — array sanitizado, sempre com prefix "#".
export async function updateSocialHashtags(id: string, hashtags: string[]): Promise<void> {
  if (!id) throw new Error("ID ausente.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const cleaned = (hashtags ?? [])
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    // Remove caracteres inválidos (espaços/símbolos) — IG só aceita letras/números/_
    .map((tag) => "#" + tag.slice(1).replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter((tag) => tag.length > 1)
    // Dedup case-insensitive mantendo primeira ocorrência
    .filter((tag, idx, arr) => arr.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) === idx)
    // Cap em 30 (limite IG)
    .slice(0, 30);

  const { error } = await supabase
    .from("social_posts")
    .update({
      hashtags: cleaned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    entity_id: id,
    action: "edit_hashtags",
    actor: user!.email ?? user!.id,
    metadata: { count: cleaned.length },
  });

  const articleId = await articleIdOf(supabase, id);
  revalidateStudio(articleId);
}

// "Switch" não muda dado no banco — é só um log auditável de qual canal o admin
// está focando. A query param `?ch=` continua sendo a fonte da verdade da UI.
// Mantido como server action pra ficar barato chamar de Link/form sem JS.
export async function switchActiveChannel(articleId: string, channel: string): Promise<void> {
  if (!articleId) throw new Error("article_id ausente.");
  if (!channel) throw new Error("channel ausente.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  await audit(supabase, {
    entity_id: articleId,
    action: "switch_channel",
    actor: user!.email ?? user!.id,
    metadata: { channel },
  });

  // Só revalida o estúdio — não muda nada no /admin/social.
  revalidatePath(`/admin/estudio/${articleId}`);
}
