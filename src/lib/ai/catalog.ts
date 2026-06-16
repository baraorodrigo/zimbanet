// Catálogo de modelos por slot.
//
// Slots = "pra que serve" (text_main, text_fast, image, video).
// Cada slot lista quais modelos podem ser escolhidos no painel admin.
//
// Adicionar provider/modelo novo = só adicionar entrada aqui.
// O resolve.ts lê catalogEntryFor(slot, modelId) pra saber qual provider
// chamar e como validar a chave.

export type SlotId = "text_main" | "text_fast" | "image" | "video";

export type Provider =
  | "anthropic"
  | "openrouter"
  | "openai"
  | "google"
  | "fal";

export type ModelEntry = {
  /** ID único no catálogo. Formato: provider:modelo. Ex: "openrouter:google/gemini-2.5-flash-image-preview". */
  id: string;
  /** Label legível pro dropdown. */
  label: string;
  provider: Provider;
  /** Nome do modelo no SDK do provider (sem o prefixo "provider:"). */
  modelId: string;
  /** Dica de formato da chave pra ajudar o admin a saber o que colar. */
  keyHint: string;
  /** Regex de validação leve. Erro grosso (colar chave errada) é capturado aqui. */
  keyPattern: RegExp;
  /** Link pra onde gerar a chave. */
  keyUrl: string;
};

export type SlotMeta = {
  id: SlotId;
  label: string;
  description: string;
  /** Modelos válidos pra esse slot. */
  models: ModelEntry[];
};

// === Helpers de definição ====================================================

const ANTHROPIC: Pick<ModelEntry, "provider" | "keyHint" | "keyPattern" | "keyUrl"> = {
  provider: "anthropic",
  keyHint: "sk-ant-…",
  keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  keyUrl: "https://console.anthropic.com/settings/keys",
};
const OPENROUTER: Pick<ModelEntry, "provider" | "keyHint" | "keyPattern" | "keyUrl"> = {
  provider: "openrouter",
  keyHint: "sk-or-v1-…",
  keyPattern: /^sk-or-[A-Za-z0-9_-]{20,}$/,
  keyUrl: "https://openrouter.ai/keys",
};
const OPENAI: Pick<ModelEntry, "provider" | "keyHint" | "keyPattern" | "keyUrl"> = {
  provider: "openai",
  keyHint: "sk-proj-… ou sk-…",
  keyPattern: /^sk-[A-Za-z0-9_-]{20,}$/,
  keyUrl: "https://platform.openai.com/api-keys",
};
const GOOGLE: Pick<ModelEntry, "provider" | "keyHint" | "keyPattern" | "keyUrl"> = {
  provider: "google",
  keyHint: "AIza…",
  keyPattern: /^AIza[A-Za-z0-9_-]{20,}$/,
  keyUrl: "https://aistudio.google.com/app/apikey",
};
const FAL: Pick<ModelEntry, "provider" | "keyHint" | "keyPattern" | "keyUrl"> = {
  provider: "fal",
  keyHint: "uuid:hex (Fal.ai dashboard)",
  keyPattern: /^[A-Za-z0-9_-]{20,}(?::[A-Za-z0-9_-]{20,})?$/,
  keyUrl: "https://fal.ai/dashboard/keys",
};

// === Modelos disponíveis =====================================================

const TEXT_MODELS = {
  // Anthropic direto
  claudeSonnetAnthropic: {
    ...ANTHROPIC,
    id: "anthropic:claude-sonnet-4-5-20250929",
    label: "Claude Sonnet 4.5 (Anthropic direto)",
    modelId: "claude-sonnet-4-5-20250929",
  } satisfies ModelEntry,
  claudeHaikuAnthropic: {
    ...ANTHROPIC,
    id: "anthropic:claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5 (Anthropic direto)",
    modelId: "claude-haiku-4-5-20251001",
  } satisfies ModelEntry,
  claudeOpusAnthropic: {
    ...ANTHROPIC,
    id: "anthropic:claude-opus-4-7",
    label: "Claude Opus 4.7 (Anthropic direto)",
    modelId: "claude-opus-4-7",
  } satisfies ModelEntry,

  // OpenRouter
  claudeSonnetOR: {
    ...OPENROUTER,
    id: "openrouter:anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5 (via OpenRouter)",
    modelId: "anthropic/claude-sonnet-4.5",
  } satisfies ModelEntry,
  claudeHaikuOR: {
    ...OPENROUTER,
    id: "openrouter:anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5 (via OpenRouter)",
    modelId: "anthropic/claude-haiku-4.5",
  } satisfies ModelEntry,
  gpt4oOR: {
    ...OPENROUTER,
    id: "openrouter:openai/gpt-4o",
    label: "GPT-4o (via OpenRouter)",
    modelId: "openai/gpt-4o",
  } satisfies ModelEntry,
  gpt4oMiniOR: {
    ...OPENROUTER,
    id: "openrouter:openai/gpt-4o-mini",
    label: "GPT-4o-mini (via OpenRouter)",
    modelId: "openai/gpt-4o-mini",
  } satisfies ModelEntry,
  gemini25ProOR: {
    ...OPENROUTER,
    id: "openrouter:google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro (via OpenRouter)",
    modelId: "google/gemini-2.5-pro",
  } satisfies ModelEntry,
  gemini25FlashOR: {
    ...OPENROUTER,
    id: "openrouter:google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash (via OpenRouter)",
    modelId: "google/gemini-2.5-flash",
  } satisfies ModelEntry,

  // --- Custo-benefício (OpenRouter, jun/2026) ---
  deepseekV4ProOR: {
    ...OPENROUTER,
    id: "openrouter:deepseek/deepseek-v4-pro",
    label: "DeepSeek V4 Pro (OpenRouter) — ótimo custo/qualidade",
    modelId: "deepseek/deepseek-v4-pro",
  } satisfies ModelEntry,
  deepseekV4FlashOR: {
    ...OPENROUTER,
    id: "openrouter:deepseek/deepseek-v4-flash",
    label: "DeepSeek V4 Flash (OpenRouter) — barato",
    modelId: "deepseek/deepseek-v4-flash",
  } satisfies ModelEntry,
  gemini35FlashOR: {
    ...OPENROUTER,
    id: "openrouter:google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash (OpenRouter)",
    modelId: "google/gemini-3.5-flash",
  } satisfies ModelEntry,
  gemini31FlashLiteOR: {
    ...OPENROUTER,
    id: "openrouter:google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite (OpenRouter) — ultra barato",
    modelId: "google/gemini-3.1-flash-lite",
  } satisfies ModelEntry,
  qwen37MaxOR: {
    ...OPENROUTER,
    id: "openrouter:qwen/qwen3.7-max",
    label: "Qwen 3.7 Max (OpenRouter)",
    modelId: "qwen/qwen3.7-max",
  } satisfies ModelEntry,
  qwen37PlusOR: {
    ...OPENROUTER,
    id: "openrouter:qwen/qwen3.7-plus",
    label: "Qwen 3.7 Plus (OpenRouter) — custo-benefício",
    modelId: "qwen/qwen3.7-plus",
  } satisfies ModelEntry,
  qwen36FlashOR: {
    ...OPENROUTER,
    id: "openrouter:qwen/qwen3.6-flash",
    label: "Qwen 3.6 Flash (OpenRouter) — barato",
    modelId: "qwen/qwen3.6-flash",
  } satisfies ModelEntry,
  minimaxM3OR: {
    ...OPENROUTER,
    id: "openrouter:minimax/minimax-m3",
    label: "MiniMax M3 (OpenRouter)",
    modelId: "minimax/minimax-m3",
  } satisfies ModelEntry,
  mistralMedium35OR: {
    ...OPENROUTER,
    id: "openrouter:mistralai/mistral-medium-3.5",
    label: "Mistral Medium 3.5 (OpenRouter)",
    modelId: "mistralai/mistral-medium-3.5",
  } satisfies ModelEntry,

  // OpenAI direto
  gpt4o: {
    ...OPENAI,
    id: "openai:gpt-4o",
    label: "GPT-4o (OpenAI direto)",
    modelId: "gpt-4o",
  } satisfies ModelEntry,
  gpt4oMini: {
    ...OPENAI,
    id: "openai:gpt-4o-mini",
    label: "GPT-4o-mini (OpenAI direto)",
    modelId: "gpt-4o-mini",
  } satisfies ModelEntry,

  // Google AI direto
  gemini25Pro: {
    ...GOOGLE,
    id: "google:gemini-2.5-pro",
    label: "Gemini 2.5 Pro (Google AI direto)",
    modelId: "gemini-2.5-pro",
  } satisfies ModelEntry,
  gemini25Flash: {
    ...GOOGLE,
    id: "google:gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Google AI direto)",
    modelId: "gemini-2.5-flash",
  } satisfies ModelEntry,
};

const IMAGE_MODELS: ModelEntry[] = [
  {
    ...OPENROUTER,
    id: "openrouter:google/gemini-3.1-flash-image-preview",
    label: "Nano Banana 2 (via OpenRouter) — recomendado",
    modelId: "google/gemini-3.1-flash-image-preview",
  },
  {
    ...OPENROUTER,
    id: "openrouter:google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro (via OpenRouter) — caro, alta qualidade",
    modelId: "google/gemini-3-pro-image-preview",
  },
  {
    ...OPENROUTER,
    id: "openrouter:google/gemini-2.5-flash-image",
    label: "Nano Banana (via OpenRouter) — barato",
    modelId: "google/gemini-2.5-flash-image",
  },
  {
    ...OPENAI,
    id: "openai:gpt-image-1",
    label: "GPT Image 1 (OpenAI direto)",
    modelId: "gpt-image-1",
  },
  {
    ...GOOGLE,
    id: "google:gemini-2.5-flash-image",
    label: "Nano Banana (Google AI direto)",
    modelId: "gemini-2.5-flash-image",
  },
  {
    ...FAL,
    id: "fal:fal-ai/flux/schnell",
    label: "Flux Schnell (Fal.ai)",
    modelId: "fal-ai/flux/schnell",
  },
  {
    ...FAL,
    id: "fal:fal-ai/flux/dev",
    label: "Flux Dev (Fal.ai)",
    modelId: "fal-ai/flux/dev",
  },
];

// Vídeo fica vazio por enquanto. Adicionar Seedance/Veo aqui quando virar prioridade.
const VIDEO_MODELS: ModelEntry[] = [];

export const SLOTS: SlotMeta[] = [
  {
    id: "text_main",
    label: "Texto principal",
    description: "Redação de matérias, drafting completo. Recomendado: DeepSeek V4 Pro (custo/qualidade) ou Gemini 3.5 Flash. Ou cole qualquer modelo do OpenRouter no campo abaixo.",
    models: [
      TEXT_MODELS.deepseekV4ProOR,
      TEXT_MODELS.gemini35FlashOR,
      TEXT_MODELS.qwen37MaxOR,
      TEXT_MODELS.minimaxM3OR,
      TEXT_MODELS.mistralMedium35OR,
      TEXT_MODELS.claudeSonnetOR,
      TEXT_MODELS.claudeSonnetAnthropic,
      TEXT_MODELS.claudeOpusAnthropic,
      TEXT_MODELS.gpt4oOR,
      TEXT_MODELS.gemini25ProOR,
      TEXT_MODELS.gpt4o,
      TEXT_MODELS.gemini25Pro,
    ],
  },
  {
    id: "text_fast",
    label: "Texto rápido",
    description: "Triagem, auto-adapt de caption, parse de slots. Recomendado: Gemini 3.1 Flash-Lite ou Qwen 3.6 Flash (baratíssimos). Ou cole qualquer modelo do OpenRouter no campo abaixo.",
    models: [
      TEXT_MODELS.gemini31FlashLiteOR,
      TEXT_MODELS.qwen36FlashOR,
      TEXT_MODELS.qwen37PlusOR,
      TEXT_MODELS.deepseekV4FlashOR,
      TEXT_MODELS.minimaxM3OR,
      TEXT_MODELS.claudeHaikuOR,
      TEXT_MODELS.claudeHaikuAnthropic,
      TEXT_MODELS.gpt4oMiniOR,
      TEXT_MODELS.gemini25FlashOR,
      TEXT_MODELS.gpt4oMini,
      TEXT_MODELS.gemini25Flash,
    ],
  },
  {
    id: "image",
    label: "Imagem",
    description: "Geração de variações pro hero/social. Nano Banana é o mais barato.",
    models: IMAGE_MODELS,
  },
  {
    id: "video",
    label: "Vídeo",
    description: "Geração de vídeo curto (Seedance/Veo). Em breve.",
    models: VIDEO_MODELS,
  },
];

export function getSlot(slot: SlotId): SlotMeta {
  const s = SLOTS.find((x) => x.id === slot);
  if (!s) throw new Error(`Slot desconhecido: ${slot}`);
  return s;
}

export function findModelEntry(slot: SlotId, modelId: string): ModelEntry | null {
  const s = getSlot(slot);
  const found = s.models.find((m) => m.id === modelId);
  if (found) return found;

  // "Modelo personalizado": aceita QUALQUER modelo do OpenRouter, mesmo que
  // não esteja na lista — basta o id no formato "openrouter:<slug>".
  // Ex.: "openrouter:deepseek/deepseek-v4-pro".
  if (modelId.startsWith("openrouter:")) {
    const slug = modelId.slice("openrouter:".length).trim();
    if (slug) {
      return {
        ...OPENROUTER,
        id: modelId,
        label: `${slug} (OpenRouter — personalizado)`,
        modelId: slug,
      };
    }
  }
  return null;
}
