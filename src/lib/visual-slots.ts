// Slot Studio — contrato de slots estruturados que alimentam o agente Visual
// (radar Python, app/agents/visual.py). Substitui o "image_prompt" em texto
// livre por campos discretos que o admin edita no Estúdio. O builder é
// determinístico — mesmos slots geram exatamente o mesmo prompt.
//
// Server-safe: nada de DOM, nada de "use client". Pode ser importado por
// Server Components, Server Actions ou pelo radar (via JSON via Supabase).

export type VisualFraming = "wide" | "close-up" | "overhead" | "portrait";
export type VisualMood =
  | "tenso"
  | "celebrativo"
  | "denuncia"
  | "comunidade"
  | "calmo"
  | "vibrante";
export type VisualStyle =
  | "fotojornalismo"
  | "ilustracao-editorial"
  | "infografico"
  | "documental";

export type VisualSlots = {
  subject: string;
  scene: string;
  framing: VisualFraming;
  mood: VisualMood;
  style: VisualStyle;
  brand_tone: string;
  negative: string;
};

export const FRAMING_OPTIONS: { value: VisualFraming; label: string }[] = [
  { value: "wide", label: "Plano aberto" },
  { value: "close-up", label: "Close" },
  { value: "overhead", label: "De cima" },
  { value: "portrait", label: "Retrato" },
];

export const MOOD_OPTIONS: { value: VisualMood; label: string }[] = [
  { value: "tenso", label: "Tenso" },
  { value: "celebrativo", label: "Celebrativo" },
  { value: "denuncia", label: "Denúncia" },
  { value: "comunidade", label: "Comunidade" },
  { value: "calmo", label: "Calmo" },
  { value: "vibrante", label: "Vibrante" },
];

export const STYLE_OPTIONS: { value: VisualStyle; label: string }[] = [
  { value: "fotojornalismo", label: "Fotojornalismo" },
  { value: "ilustracao-editorial", label: "Ilustração editorial" },
  { value: "infografico", label: "Infográfico" },
  { value: "documental", label: "Documental" },
];

// IA = ilustração, nunca foto. Em cidade pequena, IA fotorrealista mata
// credibilidade. brand_tone e negative usam termos que o modelo de imagem
// (SDXL/FLUX/DALL-E) entende — paleta com hex, formas geométricas, e bloqueio
// explícito de fotorrealismo no negative.
export const DEFAULT_BRAND_TONE =
  "editorial flat illustration, navy #0D1B2A and gold #E8B100 accents, " +
  "off-white #F5F5F5 background, geometric shapes, limited palette, " +
  "no gradients, no 3D shading";

export const DEFAULT_NEGATIVE =
  "no photorealistic faces, no recognizable people, no real photographs, " +
  "no AI-generated photos, no stock photo aesthetic, no text, no logos, " +
  "no watermarks, no clipart, no neon, no gradients, no 3D render";

export const DEFAULT_SLOTS: VisualSlots = {
  subject: "",
  scene: "",
  framing: "wide",
  mood: "comunidade",
  style: "ilustracao-editorial",
  brand_tone: DEFAULT_BRAND_TONE,
  negative: DEFAULT_NEGATIVE,
};

export const SUBJECT_MAX = 120;
export const SCENE_MAX = 160;

// ----------------------------------------------------------------
// Coerção tolerante — entrada vem do JSONB do Supabase, pode ser
// {} ou ter campos faltando. Devolve sempre um VisualSlots válido.
// ----------------------------------------------------------------
export function coerceVisualSlots(input: unknown): VisualSlots {
  if (!input || typeof input !== "object") return { ...DEFAULT_SLOTS };
  const obj = input as Record<string, unknown>;

  const framing = isFraming(obj.framing) ? obj.framing : DEFAULT_SLOTS.framing;
  const mood = isMood(obj.mood) ? obj.mood : DEFAULT_SLOTS.mood;
  const style = isStyle(obj.style) ? obj.style : DEFAULT_SLOTS.style;

  return {
    subject: typeof obj.subject === "string" ? obj.subject.slice(0, SUBJECT_MAX) : "",
    scene: typeof obj.scene === "string" ? obj.scene.slice(0, SCENE_MAX) : "",
    framing,
    mood,
    style,
    brand_tone:
      typeof obj.brand_tone === "string" && obj.brand_tone.trim()
        ? obj.brand_tone
        : DEFAULT_BRAND_TONE,
    negative:
      typeof obj.negative === "string" && obj.negative.trim()
        ? obj.negative
        : DEFAULT_NEGATIVE,
  };
}

function isFraming(v: unknown): v is VisualFraming {
  return v === "wide" || v === "close-up" || v === "overhead" || v === "portrait";
}
function isMood(v: unknown): v is VisualMood {
  return (
    v === "tenso" ||
    v === "celebrativo" ||
    v === "denuncia" ||
    v === "comunidade" ||
    v === "calmo" ||
    v === "vibrante"
  );
}
function isStyle(v: unknown): v is VisualStyle {
  return (
    v === "fotojornalismo" ||
    v === "ilustracao-editorial" ||
    v === "infografico" ||
    v === "documental"
  );
}

export function isVisualSlotsEmpty(slots: VisualSlots): boolean {
  return !slots.subject.trim() && !slots.scene.trim();
}

// ----------------------------------------------------------------
// Defaults derivados da editoria + cidade + título.
// É o "ponto de partida sensato" pra cada nova matéria.
// ----------------------------------------------------------------
type DeriveInput = {
  editoria: string;
  cities?: string[] | null;
  tags?: string[] | null;
  title: string;
};

const EDITORIA_DEFAULTS: Record<
  string,
  { mood: VisualMood; style: VisualStyle }
> = {
  policia: { mood: "tenso", style: "ilustracao-editorial" },
  cultura: { mood: "vibrante", style: "ilustracao-editorial" },
  praias: { mood: "calmo", style: "ilustracao-editorial" },
  economia: { mood: "comunidade", style: "ilustracao-editorial" },
  politica: { mood: "comunidade", style: "ilustracao-editorial" },
  esporte: { mood: "celebrativo", style: "ilustracao-editorial" },
  cidade: { mood: "comunidade", style: "ilustracao-editorial" },
  opiniao: { mood: "calmo", style: "ilustracao-editorial" },
};

export function deriveDefaultSlots(article: DeriveInput): VisualSlots {
  const editoria = (article.editoria || "").toLowerCase();
  const editoriaDefault = EDITORIA_DEFAULTS[editoria] ?? {
    mood: DEFAULT_SLOTS.mood,
    style: DEFAULT_SLOTS.style,
  };

  const city = (article.cities ?? []).find(Boolean);
  const tags = article.tags ?? [];
  const titleClean = (article.title || "").trim();

  // Sugestão de subject — primeira frase concreta a partir do título.
  // Se o título tiver mais que SUBJECT_MAX, corta no espaço mais próximo.
  const subject = trimSmart(titleClean, SUBJECT_MAX);

  // Sugestão de scene — ancora na cidade quando houver.
  const scene = city
    ? `Cena em ${city}${tags.length ? `, no contexto de ${tags.slice(0, 2).join(" e ")}` : ""}`
    : tags.length
      ? `Cena no contexto de ${tags.slice(0, 2).join(" e ")}`
      : "";

  return {
    subject,
    scene: trimSmart(scene, SCENE_MAX),
    framing: DEFAULT_SLOTS.framing,
    mood: editoriaDefault.mood,
    style: editoriaDefault.style,
    brand_tone: DEFAULT_BRAND_TONE,
    negative: DEFAULT_NEGATIVE,
  };
}

function trimSmart(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
}

// ----------------------------------------------------------------
// Builder determinístico — contrato com o Visual agent (Python).
// O radar lê articles.visual_slots e chama essa mesma função
// (port equivalente em Python no futuro) pra montar o prompt final.
// ----------------------------------------------------------------
const FRAMING_PROMPT: Record<VisualFraming, string> = {
  wide: "wide shot, plano aberto",
  "close-up": "close-up, plano fechado no detalhe",
  overhead: "overhead, vista de cima",
  portrait: "retrato vertical, foco no rosto/figura",
};

const MOOD_PROMPT: Record<VisualMood, string> = {
  tenso: "atmosfera tensa, luz dura, contraste alto",
  celebrativo: "atmosfera celebrativa, luz quente, energia coletiva",
  denuncia: "tom de denúncia, luz crua, sem idealização",
  comunidade: "tom comunitário, luz natural, gente real",
  calmo: "atmosfera calma, luz suave, paleta dessaturada",
  vibrante: "atmosfera vibrante, cores saturadas, movimento",
};

const STYLE_PROMPT: Record<VisualStyle, string> = {
  fotojornalismo: "fotojornalismo direto, sem efeitos pesados, foco editorial",
  "ilustracao-editorial":
    "editorial flat illustration in the style of The New Yorker / Politico, " +
    "clean linework, geometric shapes, limited palette of navy #0D1B2A, " +
    "gold #E8B100 and off-white #F5F5F5, no photorealism, no recognizable " +
    "faces, figures as silhouettes or abstract shapes",
  infografico: "infográfico minimalista, hierarquia clara, sem 3D",
  documental: "fotografia documental, cores reais, naturalidade",
};

export function buildPromptFromSlots(slots: VisualSlots): string {
  const subject = (slots.subject || "[assunto não definido]").trim();
  const scene = slots.scene.trim();
  const framing = FRAMING_PROMPT[slots.framing];
  const mood = MOOD_PROMPT[slots.mood];
  const style = STYLE_PROMPT[slots.style];
  const tone = (slots.brand_tone || DEFAULT_BRAND_TONE).trim();
  const negative = (slots.negative || DEFAULT_NEGATIVE).trim();

  // Estrutura PT/EN — header em PT, modificadores técnicos em EN
  // pra render melhor em modelos generalistas (SDXL, FLUX, DALL-E etc).
  const lines = [
    `Sujeito: ${subject}`,
    scene ? `Cena: ${scene}` : null,
    `Estilo: ${style}`,
    `Enquadramento: ${framing}`,
    `Atmosfera: ${mood}`,
    `Marca: ${tone}`,
    "—",
    "ZIMBANET — portal de Imbituba/SC, estética nostalgia moderna, flat, alta densidade editorial.",
    `Negative: ${negative}.`,
  ].filter(Boolean);

  return lines.join("\n");
}
