"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_BAIRROS = [
  "Centro",
  "Vila Nova",
  "Praia da Vila",
  "Itapirubá",
  "Mirim",
  "Nova Brasília",
  "Alto Arroio",
  "Guarda do Embaú",
  "Sambaqui",
  "Arroio",
  "Outro / não listado",
];

const ALLOWED_BAZAR_TYPES = ["Vende", "Doa", "Troca", "Procura"] as const;

const ALLOWED_CATEGORIES = [
  "Eletrônicos",
  "Móveis",
  "Esporte",
  "Moda",
  "Casa",
  "Auto",
  "Serviços",
  "Outros",
];

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type PublishStatus = "published" | "pending_confirmation";

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.length <= 254;
}

function originFrom(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function sendGuestMagicLink(email: string, next: string) {
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
    console.error("[sendGuestMagicLink]", error);
    return { ok: false as const, error: "Não consegui enviar o link de confirmação." };
  }
  return { ok: true as const };
}

// === Mural ====================================================================

export async function createMuralPost(
  formData: FormData,
): Promise<ActionResult<{ id: string; status: PublishStatus }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = field(formData, "body");
  const bairro = field(formData, "bairro");
  const isAnon = field(formData, "is_anon") === "on";
  const mediaUrl = field(formData, "media_url") || null;
  const guestEmail = field(formData, "email").toLowerCase();

  if (body.length < 1 || body.length > 1200) {
    return { ok: false, error: "Texto precisa ter entre 1 e 1.200 caracteres." };
  }
  if (!ALLOWED_BAIRROS.includes(bairro)) {
    return { ok: false, error: "Selecione um bairro válido." };
  }

  // ── Guest flow: precisa email pra mandar magic link
  if (!user) {
    if (!isValidEmail(guestEmail)) {
      return { ok: false, error: "Informe um email válido pra confirmar o post." };
    }

    const authorName = isAnon ? "Anônimo" : (field(formData, "author_name") || "Vizinho");

    const { data, error } = await supabase
      .from("mural_posts")
      .insert({
        user_id: null,
        pending_email: guestEmail,
        author_name: authorName.slice(0, 80),
        is_anon: isAnon,
        bairro,
        body,
        media_url: mediaUrl,
        status: "pending_confirmation",
        moderation_status: "approved",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createMuralPost guest]", error);
      return { ok: false, error: "Não consegui salvar agora. Tenta de novo." };
    }

    const link = await sendGuestMagicLink(guestEmail, "/zimbamilgrau");
    if (!link.ok) return link;

    return { ok: true, data: { id: data.id as string, status: "pending_confirmation" } };
  }

  // ── Logged flow
  const authorName = isAnon
    ? "Anônimo"
    : (field(formData, "author_name") ||
       user.user_metadata?.full_name ||
       user.email?.split("@")[0] ||
       "Vizinho");

  const { data, error } = await supabase
    .from("mural_posts")
    .insert({
      user_id: user.id,
      author_name: authorName.slice(0, 80),
      is_anon: isAnon,
      bairro,
      body,
      media_url: mediaUrl,
      status: "published",
      moderation_status: "approved",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createMuralPost]", error);
    return { ok: false, error: "Não consegui salvar agora. Tenta de novo em uns minutos." };
  }

  revalidatePath("/zimbamilgrau");
  revalidatePath("/");
  return { ok: true, data: { id: data.id as string, status: "published" } };
}

// === Bazar ====================================================================

export async function createBazarItem(
  formData: FormData,
): Promise<ActionResult<{ id: string; status: PublishStatus }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const type = field(formData, "type") as (typeof ALLOWED_BAZAR_TYPES)[number];
  const category = field(formData, "category") || null;
  const title = field(formData, "title");
  const description = field(formData, "description");
  const bairro = field(formData, "bairro");
  const whatsapp = field(formData, "whatsapp").replace(/\D/g, "");
  const priceRaw = field(formData, "price");
  const photoUrl = field(formData, "photo_url") || null;
  const guestEmail = field(formData, "email").toLowerCase();

  if (!ALLOWED_BAZAR_TYPES.includes(type)) {
    return { ok: false, error: "Tipo inválido (use Vende/Doa/Troca/Procura)." };
  }
  if (title.length < 3 || title.length > 120) {
    return { ok: false, error: "Título precisa ter entre 3 e 120 caracteres." };
  }
  if (description.length < 10 || description.length > 2000) {
    return { ok: false, error: "Descrição precisa ter entre 10 e 2.000 caracteres." };
  }
  if (!ALLOWED_BAIRROS.includes(bairro)) {
    return { ok: false, error: "Selecione um bairro válido." };
  }
  if (whatsapp.length < 10 || whatsapp.length > 13) {
    return { ok: false, error: "WhatsApp inválido. Use DDD + número (ex: 48999998888)." };
  }
  if (category && !ALLOWED_CATEGORIES.includes(category)) {
    return { ok: false, error: "Categoria inválida." };
  }

  let priceCents: number | null = null;
  let priceLabel: string | null = null;
  if (type === "Vende") {
    const cleaned = priceRaw.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num <= 0) {
      return { ok: false, error: "Informe o preço em reais (ex: 1500,00)." };
    }
    priceCents = Math.round(num * 100);
  } else if (type === "Doa") {
    priceLabel = "Grátis";
  } else {
    priceLabel = type;
  }

  const insertBase = {
    type,
    category,
    title,
    description,
    price_cents: priceCents,
    price_label: priceLabel,
    bairro,
    whatsapp,
    photo_url: photoUrl,
  };

  // ── Guest flow
  if (!user) {
    if (!isValidEmail(guestEmail)) {
      return { ok: false, error: "Informe um email pra confirmar o anúncio (você usa o link no email)." };
    }

    const { data, error } = await supabase
      .from("bazar_items")
      .insert({
        ...insertBase,
        user_id: null,
        pending_email: guestEmail,
        status: "pending_confirmation",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createBazarItem guest]", error);
      return { ok: false, error: "Não consegui salvar agora. Tenta de novo." };
    }

    const link = await sendGuestMagicLink(guestEmail, "/bazardazimba");
    if (!link.ok) return link;

    return { ok: true, data: { id: data.id as string, status: "pending_confirmation" } };
  }

  // ── Logged flow
  const { data, error } = await supabase
    .from("bazar_items")
    .insert({
      ...insertBase,
      user_id: user.id,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createBazarItem]", error);
    return { ok: false, error: "Não consegui salvar agora. Tenta de novo em uns minutos." };
  }

  revalidatePath("/bazardazimba");
  revalidatePath("/");
  return { ok: true, data: { id: data.id as string, status: "published" } };
}

// === Mural likes ==============================================================

export async function toggleMuralLike(
  formData: FormData,
): Promise<ActionResult<{ liked: boolean; count: number }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Faça login pra curtir." };
  }
  const postId = field(formData, "post_id");
  if (!postId) return { ok: false, error: "post_id ausente." };

  const existing = await supabase
    .from("mural_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from("mural_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Não consegui descurtir." };
  } else {
    const { error } = await supabase
      .from("mural_likes")
      .insert({ post_id: postId, user_id: user.id });
    if (error) return { ok: false, error: "Não consegui curtir." };
  }

  const { data: post } = await supabase
    .from("mural_posts")
    .select("likes_count")
    .eq("id", postId)
    .maybeSingle();

  revalidatePath("/zimbamilgrau");
  return {
    ok: true,
    data: {
      liked: !existing.data,
      count: (post?.likes_count as number | undefined) ?? 0,
    },
  };
}

// === Mural comments ==========================================================

export async function createMuralComment(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login pra comentar." };

  const postId = field(formData, "post_id");
  const body = field(formData, "body");
  const isAnon = field(formData, "is_anon") === "on";

  if (!postId) return { ok: false, error: "post_id ausente." };
  if (body.length < 1 || body.length > 600) {
    return { ok: false, error: "Comentário precisa ter entre 1 e 600 caracteres." };
  }

  const authorName = isAnon
    ? "Anônimo"
    : (user.user_metadata?.full_name || user.email?.split("@")[0] || "Vizinho");

  const { data, error } = await supabase
    .from("mural_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      author_name: String(authorName).slice(0, 80),
      is_anon: isAnon,
      body,
      moderation_status: "approved",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createMuralComment]", error);
    return { ok: false, error: "Não consegui salvar o comentário." };
  }

  revalidatePath("/zimbamilgrau");
  return { ok: true, data: { id: data.id as string } };
}

// === Article comments ========================================================

export async function createArticleComment(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login pra comentar." };

  const articleId = field(formData, "article_id");
  const articleSlug = field(formData, "article_slug");
  const body = field(formData, "body");

  if (!articleId) return { ok: false, error: "article_id ausente." };
  if (body.length < 2 || body.length > 1000) {
    return { ok: false, error: "Comentário precisa ter entre 2 e 1.000 caracteres." };
  }

  const authorName =
    user.user_metadata?.full_name || user.email?.split("@")[0] || "Leitor";

  const { data, error } = await supabase
    .from("article_comments")
    .insert({
      article_id: articleId,
      user_id: user.id,
      author_name: String(authorName).slice(0, 80),
      body,
      moderation_status: "approved",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createArticleComment]", error);
    return { ok: false, error: "Não consegui salvar o comentário." };
  }

  if (articleSlug) revalidatePath(`/${articleSlug}`);
  return { ok: true, data: { id: data.id as string } };
}
