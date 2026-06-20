import { createAdminClient } from "@/lib/supabase/admin";

// Fonte mais velha que isto não vira notícia. "Notícia" é fato recente —
// evita o agente pescar pauta antiga do backlog e publicar como se fosse hoje.
export const MAX_SOURCE_AGE_DAYS = 7;

type AdminClient = ReturnType<typeof createAdminClient>;

// Idade (em dias) da reportagem-fonte de um scored_item, via raw_item.published_at.
// Retorna null quando não há data conhecida (aí não dá pra afirmar que é velha —
// as outras travas, fonte+foto, seguem valendo).
export async function sourceAgeDaysByScoredId(
  sb: AdminClient,
  scoredItemId: string | null | undefined,
): Promise<number | null> {
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
  const pub = (raw as { published_at?: string | null } | null)?.published_at;
  if (!pub) return null;
  return (Date.now() - new Date(pub).getTime()) / 86_400_000;
}
