// Leituras de editorial_personas. A tabela é RLS-no-policy (só
// service_role) — toda chamada usa o admin client.

import { createAdminClient } from "@/lib/supabase/admin";
import type { EditorialPersonaRow } from "./types";

export async function listAllPersonas(): Promise<EditorialPersonaRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("editorial_personas")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.warn("[listAllPersonas]", error.message);
    return [];
  }
  return (data ?? []) as EditorialPersonaRow[];
}

export async function listActivePersonas(): Promise<EditorialPersonaRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("editorial_personas")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[listActivePersonas]", error.message);
    return [];
  }
  return (data ?? []) as EditorialPersonaRow[];
}

export async function getPersonaById(
  id: string,
): Promise<EditorialPersonaRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("editorial_personas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as EditorialPersonaRow | null) ?? null;
}

export async function getPersonaBySlug(
  slug: string,
): Promise<EditorialPersonaRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("editorial_personas")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as EditorialPersonaRow | null) ?? null;
}
