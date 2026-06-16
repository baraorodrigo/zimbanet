// Campos e regras compartilhados pelos endpoints de artigo do gateway.

export const LIST_FIELDS = "id, slug, editoria, kicker, title, status, created_at, updated_at";

export const FULL_FIELDS =
  "id, slug, editoria, kicker, title, subtitle, lede, body, byline, reading_minutes, " +
  "tags, cities, hero_image_url, hero_image_alt, is_breaking, status, source_url, created_at, updated_at";

// O agente só pode escrever estes campos de CONTEÚDO (nunca status/published_at/etc).
export const CONTENT_FIELDS = [
  "kicker",
  "title",
  "subtitle",
  "lede",
  "body",
  "byline",
  "tags",
  "cities",
  "reading_minutes",
] as const;

// Campos de SEO (não há seo_title/meta_description no schema — SEO usa slug+tags).
export const SEO_FIELDS = ["slug", "tags"] as const;

// Agente só edita rascunho/revisão. NUNCA toca matéria publicada/arquivada.
export const EDITABLE_STATUSES = ["draft", "review"];

export function pickFields(
  body: Record<string, unknown>,
  allow: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allow) {
    if (k in body && body[k] !== undefined) out[k] = body[k];
  }
  return out;
}
