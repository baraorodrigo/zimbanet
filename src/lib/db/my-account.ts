import { createClient } from "@/lib/supabase/server";
import type { BazarItemRow, MuralPostRow } from "./types";

export type MyBazarItem = BazarItemRow;
export type MyMuralPost = MuralPostRow;

export async function fetchMyBazarItems(userId: string): Promise<MyBazarItem[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bazar_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.warn("[my-account bazar]", error.message);
      return [];
    }
    return (data ?? []) as MyBazarItem[];
  } catch {
    return [];
  }
}

export async function fetchMyMuralPosts(userId: string): Promise<MyMuralPost[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mural_posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.warn("[my-account mural]", error.message);
      return [];
    }
    return (data ?? []) as MyMuralPost[];
  } catch {
    return [];
  }
}
