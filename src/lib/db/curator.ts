// Leituras da rubrica do Curador (curator_rubric). RLS sem policy —
// usa admin client. O motor zimbanet-radar bate aqui antes de cada
// rodada de scoring pra montar o prompt-sistema do Haiku.

import { createAdminClient } from "@/lib/supabase/admin";
import type { CuratorRubricRow } from "./types";

export async function getActiveRubric(): Promise<CuratorRubricRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("curator_rubric")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<CuratorRubricRow>();
  if (error) {
    console.warn("[getActiveRubric]", error.message);
    return null;
  }
  return data ?? null;
}

export async function listRubricVersions(): Promise<CuratorRubricRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("curator_rubric")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[listRubricVersions]", error.message);
    return [];
  }
  return (data ?? []) as CuratorRubricRow[];
}
