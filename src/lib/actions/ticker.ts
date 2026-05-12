"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function intField(formData: FormData, key: string, fallback: number): number {
  const v = field(formData, key);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bumpRevalidate() {
  revalidatePath("/");
  revalidatePath("/admin/ticker");
}

export async function createTickerMessage(formData: FormData) {
  await requireAdmin();
  const text = field(formData, "text");
  if (text.length < 2 || text.length > 240) {
    redirect(`/admin/ticker?erro=${encodeURIComponent("A mensagem precisa ter entre 2 e 240 caracteres.")}`);
  }
  const link = field(formData, "link") || null;
  const kicker = field(formData, "kicker") || null;
  const sort_order = intField(formData, "sort_order", 0);
  const is_active = formData.get("is_active") === "on";

  const admin = createAdminClient();
  const { error } = await admin.from("ticker_messages").insert({
    text,
    link,
    kicker,
    sort_order,
    is_active,
  });
  if (error) {
    redirect(`/admin/ticker?erro=${encodeURIComponent(error.message)}`);
  }
  bumpRevalidate();
  redirect("/admin/ticker?ok=1");
}

export async function updateTickerMessage(formData: FormData) {
  await requireAdmin();
  const id = field(formData, "id");
  if (!id) redirect("/admin/ticker?erro=Id+inválido");
  const text = field(formData, "text");
  if (text.length < 2 || text.length > 240) {
    redirect(`/admin/ticker?erro=${encodeURIComponent("A mensagem precisa ter entre 2 e 240 caracteres.")}`);
  }
  const link = field(formData, "link") || null;
  const kicker = field(formData, "kicker") || null;
  const sort_order = intField(formData, "sort_order", 0);
  const is_active = formData.get("is_active") === "on";

  const admin = createAdminClient();
  const { error } = await admin
    .from("ticker_messages")
    .update({ text, link, kicker, sort_order, is_active })
    .eq("id", id);
  if (error) {
    redirect(`/admin/ticker?erro=${encodeURIComponent(error.message)}`);
  }
  bumpRevalidate();
  redirect("/admin/ticker?ok=1");
}

export async function toggleTickerMessage(formData: FormData) {
  await requireAdmin();
  const id = field(formData, "id");
  if (!id) return;
  const admin = createAdminClient();
  const { data } = await admin
    .from("ticker_messages")
    .select("is_active")
    .eq("id", id)
    .maybeSingle();
  const current = (data as { is_active: boolean } | null)?.is_active ?? false;
  await admin.from("ticker_messages").update({ is_active: !current }).eq("id", id);
  bumpRevalidate();
}

export async function deleteTickerMessage(formData: FormData) {
  await requireAdmin();
  const id = field(formData, "id");
  if (!id) return;
  const admin = createAdminClient();
  await admin.from("ticker_messages").delete().eq("id", id);
  bumpRevalidate();
}
