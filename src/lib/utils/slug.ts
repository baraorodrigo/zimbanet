import type { SupabaseClient } from "@supabase/supabase-js";

// "Porto de Imbituba bate recorde!" -> "porto-de-imbituba-bate-recorde"
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

// Garante slug único na tabela articles. Anexa "-2", "-3"... se já existir.
export async function uniqueArticleSlug(
  supabase: SupabaseClient,
  base: string,
): Promise<string> {
  const root = slugify(base) || "materia";
  let candidate = root;
  let n = 2;
  while (n < 100) {
    const { data } = await supabase
      .from("articles")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${root}-${n++}`;
  }
  return `${root}-${Date.now()}`;
}
