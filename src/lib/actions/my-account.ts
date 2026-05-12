"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireOwnership<T extends { user_id: string | null }>(
  table: "bazar_items" | "mural_posts",
  id: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login pra gerenciar seus anúncios." };

  const { data, error } = await supabase
    .from(table)
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Item não encontrado." };
  if ((data as T).user_id !== user.id) {
    return { ok: false, error: "Esse item não é seu." };
  }
  return { ok: true, userId: user.id };
}

// === Bazar ===================================================================

export async function setBazarItemStatus(
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { ok: false, error: "id ausente." };
  if (!["active", "sold", "expired", "removed"].includes(status)) {
    return { ok: false, error: "Status inválido." };
  }

  const own = await requireOwnership("bazar_items", id);
  if (!own.ok) return own;

  const supabase = createClient();
  const { error } = await supabase
    .from("bazar_items")
    .update({ status })
    .eq("id", id)
    .eq("user_id", own.userId);
  if (error) {
    console.error("[setBazarItemStatus]", error);
    return { ok: false, error: "Não consegui atualizar agora." };
  }

  revalidatePath("/minha-conta");
  revalidatePath("/bazardazimba");
  return { ok: true };
}

export async function deleteBazarItem(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "id ausente." };

  const own = await requireOwnership("bazar_items", id);
  if (!own.ok) return own;

  const supabase = createClient();
  const { error } = await supabase
    .from("bazar_items")
    .delete()
    .eq("id", id)
    .eq("user_id", own.userId);
  if (error) {
    console.error("[deleteBazarItem]", error);
    return { ok: false, error: "Não consegui apagar agora." };
  }

  revalidatePath("/minha-conta");
  revalidatePath("/bazardazimba");
  return { ok: true };
}

// === Mural ===================================================================

export async function deleteMuralPost(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "id ausente." };

  const own = await requireOwnership("mural_posts", id);
  if (!own.ok) return own;

  const supabase = createClient();
  const { error } = await supabase
    .from("mural_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", own.userId);
  if (error) {
    console.error("[deleteMuralPost]", error);
    return { ok: false, error: "Não consegui apagar agora." };
  }

  revalidatePath("/minha-conta");
  revalidatePath("/zimbamilgrau");
  return { ok: true };
}
