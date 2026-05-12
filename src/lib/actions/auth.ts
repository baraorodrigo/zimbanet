"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string };

function originFrom(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// === OAuth (Google) ==========================================================

export async function signInWithGoogle(redirectTo?: string): Promise<never | AuthResult> {
  const supabase = createClient();
  const origin = originFrom();
  const next = safeNext(redirectTo);
  const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback },
  });

  if (error) {
    console.error("[signInWithGoogle]", error);
    return { ok: false, error: "Não consegui iniciar login com Google." };
  }
  if (data.url) redirect(data.url);
  return { ok: false, error: "Resposta inesperada do Supabase Auth." };
}

// === Magic link por email ====================================================

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.length <= 254;
}

export async function sendEmailMagicLink(formData: FormData): Promise<AuthResult> {
  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  const next = safeNext((formData.get("next") as string | null) ?? "/");

  if (!isValidEmail(email)) {
    return { ok: false, error: "Email inválido." };
  }

  const supabase = createClient();
  const origin = originFrom();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    console.error("[sendEmailMagicLink]", error);
    return { ok: false, error: "Não consegui enviar o link. Tenta de novo." };
  }
  return { ok: true, data: { email } };
}

// === SMS OTP =================================================================

function normalizePhoneBR(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith("55")) return `+${digits}`;
  return null;
}

export async function sendPhoneOtp(formData: FormData): Promise<AuthResult> {
  const raw = (formData.get("phone") as string | null) ?? "";
  const phone = normalizePhoneBR(raw);
  if (!phone) {
    return { ok: false, error: "Número inválido. Use DDD + celular (ex: 48 99999-9999)." };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { channel: "sms" },
  });
  if (error) {
    console.error("[sendPhoneOtp]", error);
    return { ok: false, error: error.message || "Não consegui enviar o SMS." };
  }
  return { ok: true, data: { phone } };
}

export async function verifyPhoneOtp(formData: FormData): Promise<AuthResult> {
  const raw = (formData.get("phone") as string | null) ?? "";
  const token = (formData.get("token") as string | null)?.trim() ?? "";
  const next = safeNext((formData.get("next") as string | null) ?? "/");
  const phone = normalizePhoneBR(raw);
  if (!phone) return { ok: false, error: "Número inválido." };
  if (!/^\d{4,8}$/.test(token)) {
    return { ok: false, error: "Código inválido. Cheque o SMS." };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  if (error) {
    console.error("[verifyPhoneOtp]", error);
    return { ok: false, error: "Código não bateu. Tenta de novo." };
  }
  revalidatePath("/", "layout");
  redirect(next);
}

// === Dev-only: login com usuário fixo de teste ==============================

export async function signInAsDev(formData: FormData): Promise<AuthResult | never> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Login de dev desabilitado em produção." };
  }
  const password = process.env.ZIMBANET_DEV_PASSWORD;
  if (!password) {
    return { ok: false, error: "Login de dev desabilitado em produção." };
  }
  const next = safeNext((formData.get("next") as string | null) ?? "/");
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: "rodrigo+dev@zimbanet.dev",
    password,
  });
  if (error) {
    console.error("[signInAsDev]", error);
    return { ok: false, error: "Login dev falhou: " + error.message };
  }
  revalidatePath("/", "layout");
  redirect(next);
}

// === Sign out ================================================================

export async function signOut(): Promise<never> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
