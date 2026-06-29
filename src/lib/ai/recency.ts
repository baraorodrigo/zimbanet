import { createAdminClient } from "@/lib/supabase/admin";

// Fuso editorial do ZIMBANET: notícia de ontem não sobe como se fosse de hoje.
export const NEWS_TIMEZONE = "America/Sao_Paulo";

type AdminClient = ReturnType<typeof createAdminClient>;

function dayKeyInNewsTz(input: string | Date): string {
  const value = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NEWS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function isFromTodayInNewsTz(
  input: string | Date,
  now: Date = new Date(),
): boolean {
  return dayKeyInNewsTz(input) === dayKeyInNewsTz(now);
}

export async function sourcePublishedAtByScoredId(
  sb: AdminClient,
  scoredItemId: string | null | undefined,
): Promise<string | null> {
  if (!scoredItemId) return null;
  const { data: sc } = await sb
    .from("scored_items")
    .select("raw_item_id")
    .eq("id", scoredItemId)
    .maybeSingle();
  const rawId = (sc as { raw_item_id?: string | null } | null)?.raw_item_id;
  if (!rawId) return null;
  const { data: raw } = await sb
    .from("raw_items")
    .select("published_at")
    .eq("id", rawId)
    .maybeSingle();
  return (raw as { published_at?: string | null } | null)?.published_at ?? null;
}

// Idade (em dias) da reportagem-fonte de um scored_item, via raw_item.published_at.
// Retorna null quando não há data conhecida.
export async function sourceAgeDaysByScoredId(
  sb: AdminClient,
  scoredItemId: string | null | undefined,
): Promise<number | null> {
  const pub = await sourcePublishedAtByScoredId(sb, scoredItemId);
  if (!pub) return null;
  return (Date.now() - new Date(pub).getTime()) / 86_400_000;
}

// Fonte mais velha que isto não vira notícia (evita publicar fato velho).
// Decisão editorial do Rodrigo (2026-06): 72h cobre hoje/ontem/anteontem e é
// IMUNE ao bug de "vira ontem à meia-noite" — compara IDADE, não dia do calendário.
export const MAX_SOURCE_AGE_HOURS = 72;

// "A fonte é recente o bastante pra virar notícia?" Antes era "é de hoje" (dia do
// calendário) — o que barrava uma matéria de 3h atrás só por já ter passado da
// meia-noite. Agora é por IDADE (≤ MAX_SOURCE_AGE_HOURS). true/false = data
// conhecida; null = data desconhecida → outras travas decidem.
export async function sourceIsRecentByScoredId(
  sb: AdminClient,
  scoredItemId: string | null | undefined,
  now: Date = new Date(),
): Promise<boolean | null> {
  const pub = await sourcePublishedAtByScoredId(sb, scoredItemId);
  if (!pub) return null;
  const ageHours = (now.getTime() - new Date(pub).getTime()) / 3_600_000;
  return ageHours <= MAX_SOURCE_AGE_HOURS;
}
