import { createClient } from "@/lib/supabase/server";
import type { BazarItem, MuralPost } from "@/lib/mock-data";
import type { BazarItemRow, MuralPostRow } from "./types";

// "há X min/h/d" / "ontem". Mesma função do articles.ts — duplicada de
// propósito pra cada módulo ser autocontido.
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function toMuralPost(row: MuralPostRow): MuralPost {
  return {
    id: row.id,
    author: row.is_anon ? "Anônimo" : row.author_name,
    bairro: row.bairro,
    postedAt: relativeTime(row.created_at),
    body: row.body,
    isAnon: row.is_anon,
    likes: row.likes_count,
    comments: row.comments_count,
  };
}

function priceLabelFrom(row: BazarItemRow): string {
  if (row.price_label) return row.price_label;
  if (row.type === "Doa") return "Grátis";
  if (row.type === "Procura") return "Procura";
  if (row.type === "Troca") return "Troca";
  if (row.price_cents != null && row.price_cents > 0) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(row.price_cents / 100);
  }
  return "A combinar";
}

function toBazarItem(row: BazarItemRow): BazarItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    price: priceLabelFrom(row),
    bairro: row.bairro,
    postedAt: relativeTime(row.created_at),
    category: row.category ?? undefined,
    description: row.description,
    whatsapp: row.whatsapp,
    photo_url: row.photo_url ?? undefined,
  };
}

export async function fetchBazarItemById(id: string): Promise<BazarItem | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bazar_items")
      .select("*")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
    if (error || !data) return null;
    return toBazarItem(data as BazarItemRow);
  } catch {
    return null;
  }
}

const TABLE_MISSING_PATTERN = /(does not exist|42P01)/i;
const DYNAMIC_BAILOUT_PATTERN = /Dynamic server usage|DYNAMIC_SERVER_USAGE/i;

export async function fetchMuralPosts(opts: { limit?: number; bairro?: string } = {}): Promise<MuralPost[]> {
  try {
    const supabase = createClient();
    let q = supabase
      .from("mural_posts")
      .select("*")
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 50);
    if (opts.bairro) q = q.eq("bairro", opts.bairro);
    const { data, error } = await q;
    if (error) {
      if (error.code === "42P01" || TABLE_MISSING_PATTERN.test(error.message)) return [];
      console.warn("[mural] supabase error", error.message);
      return [];
    }
    return (data ?? []).map((r) => toMuralPost(r as MuralPostRow));
  } catch (e) {
    const msg = (e as Error).message;
    if (!DYNAMIC_BAILOUT_PATTERN.test(msg)) console.warn("[mural] fetch failed", msg);
    return [];
  }
}

export async function fetchBazarItems(opts: {
  limit?: number;
  type?: BazarItem["type"];
  category?: string;
} = {}): Promise<BazarItem[]> {
  try {
    const supabase = createClient();
    let q = supabase
      .from("bazar_items")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 60);
    if (opts.type) q = q.eq("type", opts.type);
    if (opts.category) q = q.eq("category", opts.category);
    const { data, error } = await q;
    if (error) {
      if (error.code === "42P01" || TABLE_MISSING_PATTERN.test(error.message)) return [];
      console.warn("[bazar] supabase error", error.message);
      return [];
    }
    return (data ?? []).map((r) => toBazarItem(r as BazarItemRow));
  } catch (e) {
    const msg = (e as Error).message;
    if (!DYNAMIC_BAILOUT_PATTERN.test(msg)) console.warn("[bazar] fetch failed", msg);
    return [];
  }
}

// Composição de homepage / pages — só Supabase. Quando vazio, retorna lista
// vazia e a UI renderiza estado vazio (sem mock em prod).
export async function getMuralPostsWithFallback(limit = 24): Promise<{
  posts: MuralPost[];
  source: "supabase" | "mock";
}> {
  const real = await fetchMuralPosts({ limit });
  return { posts: real, source: "supabase" };
}

export async function getBazarItemsWithFallback(limit = 36): Promise<{
  items: BazarItem[];
  source: "supabase" | "mock";
}> {
  const real = await fetchBazarItems({ limit });
  return { items: real, source: "supabase" };
}

export async function fetchMuralLikedSet(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("mural_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds);
    return new Set((data ?? []).map((r) => r.post_id as string));
  } catch {
    return new Set();
  }
}

export type MuralCommentRow = {
  id: string;
  post_id: string;
  author_name: string;
  is_anon: boolean;
  body: string;
  created_at: string;
};

export async function fetchMuralComments(postIds: string[]): Promise<Map<string, MuralCommentRow[]>> {
  const out = new Map<string, MuralCommentRow[]>();
  if (postIds.length === 0) return out;
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("mural_comments")
      .select("id, post_id, author_name, is_anon, body, created_at")
      .in("post_id", postIds)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: true });
    for (const row of (data ?? []) as MuralCommentRow[]) {
      const list = out.get(row.post_id) ?? [];
      list.push(row);
      out.set(row.post_id, list);
    }
    return out;
  } catch {
    return out;
  }
}
