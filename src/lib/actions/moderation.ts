"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function ensureStaff() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isStaff(user)) {
    return { ok: false as const, error: "Sem permissão." };
  }
  return { ok: true as const, user, supabase };
}

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function moderateMuralPost(
  formData: FormData,
): Promise<ActionResult> {
  const guard = await ensureStaff();
  if (!guard.ok) return { ok: false, error: guard.error };
  const id = field(formData, "id");
  const action = field(formData, "action") as "approve" | "reject";
  if (!id || (action !== "approve" && action !== "reject")) {
    return { ok: false, error: "Parâmetros inválidos." };
  }
  const status =
    action === "approve" ? "approved" : "rejected";
  const { error } = await guard.supabase
    .from("mural_posts")
    .update({ moderation_status: status, status: action === "approve" ? "published" : "removed" })
    .eq("id", id);
  if (error) {
    console.error("[moderateMuralPost]", error);
    return { ok: false, error: "Não consegui aplicar a moderação." };
  }
  await guard.supabase.from("audit_log").insert({
    entity_type: "mural_post",
    entity_id: id,
    action: `moderate_${action}`,
    actor: guard.user.email ?? "staff",
  });
  revalidatePath("/admin/moderacao");
  revalidatePath("/zimbamilgrau");
  return { ok: true };
}

export async function moderateMuralComment(
  formData: FormData,
): Promise<ActionResult> {
  const guard = await ensureStaff();
  if (!guard.ok) return { ok: false, error: guard.error };
  const id = field(formData, "id");
  const action = field(formData, "action") as "approve" | "reject";
  if (!id || (action !== "approve" && action !== "reject")) {
    return { ok: false, error: "Parâmetros inválidos." };
  }
  const { error } = await guard.supabase
    .from("mural_comments")
    .update({ moderation_status: action === "approve" ? "approved" : "rejected" })
    .eq("id", id);
  if (error) return { ok: false, error: "Falhou." };
  revalidatePath("/admin/moderacao");
  revalidatePath("/zimbamilgrau");
  return { ok: true };
}

export async function moderateArticleComment(
  formData: FormData,
): Promise<ActionResult> {
  const guard = await ensureStaff();
  if (!guard.ok) return { ok: false, error: guard.error };
  const id = field(formData, "id");
  const action = field(formData, "action") as "approve" | "reject";
  if (!id || (action !== "approve" && action !== "reject")) {
    return { ok: false, error: "Parâmetros inválidos." };
  }
  const status = action === "approve" ? "approved" : "rejected";
  const { error } = await guard.supabase
    .from("article_comments")
    .update({ moderation_status: status })
    .eq("id", id);
  if (error) {
    console.error("[moderateArticleComment]", error);
    return { ok: false, error: "Não consegui aplicar a moderação." };
  }
  await guard.supabase.from("audit_log").insert({
    entity_type: "article_comment",
    entity_id: id,
    action: `moderate_${action}`,
    actor: guard.user.email ?? "staff",
  });
  revalidatePath("/admin/moderacao");
  return { ok: true };
}

export async function moderateBazarItem(
  formData: FormData,
): Promise<ActionResult> {
  const guard = await ensureStaff();
  if (!guard.ok) return { ok: false, error: guard.error };
  const id = field(formData, "id");
  const action = field(formData, "action") as "approve" | "reject";
  if (!id || (action !== "approve" && action !== "reject")) {
    return { ok: false, error: "Parâmetros inválidos." };
  }
  const status = action === "approve" ? "active" : "removed";
  const { error } = await guard.supabase
    .from("bazar_items")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: "Falhou." };
  await guard.supabase.from("audit_log").insert({
    entity_type: "bazar_item",
    entity_id: id,
    action: `moderate_${action}`,
    actor: guard.user.email ?? "staff",
  });
  revalidatePath("/admin/moderacao");
  revalidatePath("/bazardazimba");
  return { ok: true };
}
