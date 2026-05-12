"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";
import {
  coerceVisualSlots,
  deriveDefaultSlots,
  buildPromptFromSlots,
  type VisualSlots,
} from "@/lib/visual-slots";

// ----------------------------------------------------------------
// Persiste os slots editados no Estúdio. Auto-save no blur — não tem
// botão "salvar" no UI, então essa action precisa ser barata e idempotente.
// ----------------------------------------------------------------
export async function updateVisualSlots(
  articleId: string,
  slots: VisualSlots,
): Promise<void> {
  if (!articleId) throw new Error("articleId ausente.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  // Coerção defensiva — protege contra payload mal-formado vindo do client.
  const safe = coerceVisualSlots(slots);

  const { error } = await supabase
    .from("articles")
    .update({
      visual_slots: safe,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/estudio");
  revalidatePath("/admin/social");
}

// ----------------------------------------------------------------
// Reseta pros defaults da editoria (deriveDefaultSlots).
// Usado pelo botão "↺ Resetar" do SlotStudio.
// ----------------------------------------------------------------
export async function resetVisualSlots(articleId: string): Promise<VisualSlots> {
  if (!articleId) throw new Error("articleId ausente.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  const { data: article, error: fetchError } = await supabase
    .from("articles")
    .select("editoria, cities, tags, title")
    .eq("id", articleId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!article) throw new Error("Matéria não encontrada.");

  const slots = deriveDefaultSlots({
    editoria: (article as { editoria: string }).editoria,
    cities: (article as { cities: string[] | null }).cities,
    tags: (article as { tags: string[] | null }).tags,
    title: (article as { title: string }).title,
  });

  const { error } = await supabase
    .from("articles")
    .update({
      visual_slots: slots,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "reset_visual_slots",
    actor: user!.email ?? user!.id,
    agent: "admin_ui_estudio_slots",
    metadata: { editoria: (article as { editoria: string }).editoria },
  });

  revalidatePath("/admin/estudio");
  revalidatePath("/admin/social");

  return slots;
}

// ----------------------------------------------------------------
// Enfileira regeneração de imagem a partir dos slots atuais.
// Por enquanto: persiste slots + grava marker em audit_log. A geração
// efetiva é disparada pela VariationsGallery via evento `zb-empty-action`.
// ----------------------------------------------------------------
export async function regenerateImageFromSlots(
  articleId: string,
  socialPostId: string,
): Promise<{ queued: boolean; message: string }> {
  if (!articleId) throw new Error("articleId ausente.");
  if (!socialPostId) throw new Error("socialPostId ausente.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");

  // Lê os slots atuais e compila o prompt — guarda no metadata pra debug.
  const { data: article, error: fetchError } = await supabase
    .from("articles")
    .select("visual_slots")
    .eq("id", articleId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const slots = coerceVisualSlots(
    (article as { visual_slots: unknown } | null)?.visual_slots,
  );
  const compiledPrompt = buildPromptFromSlots(slots);

  const { error: auditError } = await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: socialPostId,
    action: "queue_image_regen",
    actor: user!.email ?? user!.id,
    agent: "admin_ui_estudio_slots",
    metadata: {
      article_id: articleId,
      slots,
      compiled_prompt: compiledPrompt,
      queued_at: new Date().toISOString(),
    },
  });
  if (auditError) throw new Error(auditError.message);

  revalidatePath("/admin/estudio");

  return {
    queued: true,
    message:
      "Slots salvos. Gere a imagem no Estúdio quando quiser.",
  };
}
