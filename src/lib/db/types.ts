// DTOs do Content Engine — espelho TS das tabelas em supabase/migrations/.
// Editorias minúsculas no banco, exibidas em CAIXA-ALTA na UI.

export type EditoriaSlug =
  | "cidade"
  | "politica"
  | "esporte"
  | "cultura"
  | "policia"
  | "praias"
  | "economia"
  | "opiniao";

export type EditoriaLabel =
  | "CIDADE"
  | "POLÍTICA"
  | "ESPORTE"
  | "CULTURA"
  | "POLÍCIA"
  | "PRAIAS"
  | "ECONOMIA"
  | "OPINIÃO";

export const EDITORIA_LABEL: Record<EditoriaSlug, EditoriaLabel> = {
  cidade: "CIDADE",
  politica: "POLÍTICA",
  esporte: "ESPORTE",
  cultura: "CULTURA",
  policia: "POLÍCIA",
  praias: "PRAIAS",
  economia: "ECONOMIA",
  opiniao: "OPINIÃO",
};

export const EDITORIA_SLUGS: EditoriaSlug[] = [
  "cidade",
  "politica",
  "esporte",
  "cultura",
  "policia",
  "praias",
  "economia",
  "opiniao",
];

export const EDITORIA_DESCRIPTION: Record<EditoriaSlug, string> = {
  cidade: "O dia a dia de Imbituba — obras, serviços, mobilidade, prefeitura.",
  politica: "Câmara, prefeitura, eleições e os bastidores do poder em Imbituba e região.",
  esporte: "Surfe, futebol regional, atletismo e tudo que rola nos campos e nas ondas.",
  cultura: "Festas tradicionais, música, literatura e a cena cultural do litoral sul.",
  policia: "Cobertura factual e responsável da segurança pública em Imbituba e região.",
  praias: "Rosa, Vila, Ferrugem, Silveira — o litoral que define a região.",
  economia: "Porto, comércio, turismo e o que move a economia de Imbituba.",
  opiniao: "Colunas, editoriais e análises da redação ZIMBANET.",
};

const LABEL_TO_SLUG: Record<string, EditoriaSlug> = Object.fromEntries(
  Object.entries(EDITORIA_LABEL).map(([slug, label]) => [label, slug as EditoriaSlug]),
);

// Recebe "POLÍTICA" / "POLITICA" / "Política" / "policia" e devolve o slug
// ASCII ("politica"). Cai pra "cidade" se não bater.
export function slugFromLabel(label: string): EditoriaSlug {
  const upper = label.toUpperCase();
  if (LABEL_TO_SLUG[upper]) return LABEL_TO_SLUG[upper];
  // tolerância pra acento removido manualmente (ex: já era "POLITICA")
  const ascii = upper
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if ((EDITORIA_SLUGS as string[]).includes(ascii)) return ascii as EditoriaSlug;
  return "cidade";
}

export type ArticleRow = {
  id: string;
  slug: string;
  editoria: EditoriaSlug;
  kicker: string | null;
  title: string;
  subtitle: string | null;
  lede: string | null;
  body: string;
  byline: string | null;
  reading_minutes: number | null;
  hero_image_url: string | null;
  hero_image_credit: string | null;
  hero_image_alt: string | null;
  tags: string[];
  cities: string[];
  is_breaking: boolean;
  is_exclusive: boolean;
  is_cover: boolean;
  is_highlight: boolean;
  status: "draft" | "review" | "scheduled" | "published" | "archived" | "rejected";
  risk_score: number | null;
  confidence: number | null;
  auto_published: boolean;
  persona_id: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  source_url: string | null;
};

export type CuratorRubricRow = {
  id: string;
  prompt_version: number;
  editorial_voice: string | null;
  relevance_rules: string;
  virality_rules: string;
  risk_rules: string;
  focus_cities: string[];
  trigger_keywords: string[];
  block_keywords: string[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type EditorialPersonaRow = {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  description: string | null;
  system_prompt: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MuralPostRow = {
  id: string;
  user_id: string | null;
  author_name: string;
  is_anon: boolean;
  bairro: string;
  body: string;
  media_url: string | null;
  likes_count: number;
  comments_count: number;
  moderation_status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type BazarItemRow = {
  id: string;
  user_id: string | null;
  type: "Vende" | "Doa" | "Troca" | "Procura";
  category: string | null;
  title: string;
  description: string;
  price_cents: number | null;
  price_label: string | null;
  bairro: string;
  whatsapp: string;
  photo_url: string | null;
  status: "active" | "sold" | "expired" | "removed";
  expires_at: string;
  created_at: string;
};

export type SocialPostRow = {
  id: string;
  article_id: string;
  channel:
    | "instagram_feed"
    | "instagram_story"
    | "instagram_carousel"
    | "facebook"
    | "whatsapp"
    | "telegram"
    | "push";
  format:
    | "card_1080"
    | "story_1080x1920"
    | "carousel_slide"
    | "banner_1200x630"
    | "text_only";
  caption: string | null;
  hashtags: string[];
  body_html: string | null;
  text_short: string | null;
  media_url: string | null;
  template_id: string | null;
  status: "pending" | "generating" | "ready" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  published_at: string | null;
  external_url: string | null;
};
