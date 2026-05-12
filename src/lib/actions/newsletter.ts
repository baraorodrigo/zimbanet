"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.length <= 254;
}

export async function subscribeNewsletter(
  formData: FormData,
): Promise<ActionResult<{ status: "subscribed" | "already" }>> {
  const raw = (formData.get("email") as string | null) ?? "";
  const email = raw.trim().toLowerCase();
  const source = ((formData.get("source") as string | null) ?? "").slice(0, 80);

  if (!isValidEmail(email)) {
    return { ok: false, error: "Informe um email válido." };
  }

  try {
    const supabase = createAdminClient();
    const h = headers();
    const ua = h.get("user-agent")?.slice(0, 240) ?? null;

    const existing = await supabase
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existing.data) {
      if (existing.data.status === "active") {
        return { ok: true, data: { status: "already" } };
      }
      // reativa quem tinha cancelado
      await supabase
        .from("newsletter_subscribers")
        .update({ status: "active", source: source || null })
        .eq("id", existing.data.id);
      return { ok: true, data: { status: "subscribed" } };
    }

    const { error } = await supabase.from("newsletter_subscribers").insert({
      email,
      source: source || null,
      user_agent: ua,
      status: "active",
    });

    if (error) {
      // se a tabela não existir ainda, falha silenciosamente OK pra UX
      if (error.code === "42P01") {
        console.warn("[newsletter] tabela ainda não existe");
        return { ok: true, data: { status: "subscribed" } };
      }
      console.error("[subscribeNewsletter]", error);
      return { ok: false, error: "Não consegui salvar agora. Tenta de novo." };
    }
    return { ok: true, data: { status: "subscribed" } };
  } catch (e) {
    console.error("[subscribeNewsletter] outer", e);
    return { ok: false, error: "Erro inesperado. Tenta novamente." };
  }
}
