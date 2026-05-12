// generateText: dispatch de geração de texto pelo provider do slot.
// Substitui o antigo callAnthropic. Mantém shape de retorno compatível
// pro single caller (auto-adapt) só trocar o import.

import { resolveSlot } from "./resolve";
import type { Provider, SlotId } from "./catalog";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export type TextMessage = { role: "user" | "assistant"; content: string };

export type TextRequest = {
  slot: SlotId; // "text_main" ou "text_fast"
  system?: string;
  messages: TextMessage[];
  max_tokens?: number;
  temperature?: number;
};

export type TextResponse = {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string | null;
  provider: Provider;
  modelId: string;
};

export async function generateText(req: TextRequest): Promise<TextResponse> {
  const { provider, modelId, apiKey } = await resolveSlot(req.slot);

  switch (provider) {
    case "anthropic":
      return callAnthropic(apiKey, modelId, req);
    case "openrouter":
      return callOpenAICompat(OPENROUTER_API_URL, apiKey, modelId, req, "openrouter");
    case "openai":
      return callOpenAICompat(OPENAI_API_URL, apiKey, modelId, req, "openai");
    case "google":
      return callGoogle(apiKey, modelId, req);
    default:
      throw new Error(`Provider ${provider} não suporta texto.`);
  }
}

// === Anthropic native ========================================================

async function callAnthropic(
  apiKey: string,
  modelId: string,
  req: TextRequest,
): Promise<TextResponse> {
  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: req.max_tokens ?? 1024,
    messages: req.messages,
  };
  if (req.system) body.system = req.system;
  if (typeof req.temperature === "number") body.temperature = req.temperature;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await safeText(res)}`);
  }
  const payload = await res.json();
  const blocks: Array<{ type?: string; text?: string }> = Array.isArray(payload?.content)
    ? payload.content
    : [];
  const text = blocks
    .filter((b) => b?.type === "text" && typeof b?.text === "string")
    .map((b) => b.text as string)
    .join("");
  return {
    text,
    usage: {
      input_tokens: payload?.usage?.input_tokens ?? 0,
      output_tokens: payload?.usage?.output_tokens ?? 0,
    },
    stop_reason: payload?.stop_reason ?? null,
    provider: "anthropic",
    modelId,
  };
}

// === OpenAI-compatível (OpenAI + OpenRouter) ================================

async function callOpenAICompat(
  url: string,
  apiKey: string,
  modelId: string,
  req: TextRequest,
  provider: Provider,
): Promise<TextResponse> {
  const messages: Array<{ role: string; content: string }> = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push(...req.messages);

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: req.max_tokens ?? 1024,
  };
  if (typeof req.temperature === "number") body.temperature = req.temperature;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") {
    headers["http-referer"] = "https://zimbanet.com";
    headers["x-title"] = "ZIMBANET";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `${provider === "openai" ? "OpenAI" : "OpenRouter"} ${res.status}: ${await safeText(res)}`,
    );
  }
  const payload = await res.json();
  const choice = payload?.choices?.[0]?.message;
  let text = "";
  if (typeof choice?.content === "string") text = choice.content;
  else if (Array.isArray(choice?.content)) {
    const parts: Array<{ type?: string; text?: string }> = choice.content;
    text = parts
      .filter((p) => p?.type === "text" && typeof p?.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  return {
    text,
    usage: {
      input_tokens: payload?.usage?.prompt_tokens ?? 0,
      output_tokens: payload?.usage?.completion_tokens ?? 0,
    },
    stop_reason: payload?.choices?.[0]?.finish_reason ?? null,
    provider,
    modelId,
  };
}

// === Google AI (Gemini direto) ==============================================

async function callGoogle(
  apiKey: string,
  modelId: string,
  req: TextRequest,
): Promise<TextResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = req.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = { contents };
  if (req.system) {
    body.systemInstruction = { parts: [{ text: req.system }] };
  }
  const genConfig: Record<string, unknown> = {};
  if (typeof req.temperature === "number") genConfig.temperature = req.temperature;
  if (typeof req.max_tokens === "number") genConfig.maxOutputTokens = req.max_tokens;
  if (Object.keys(genConfig).length) body.generationConfig = genConfig;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Google AI ${res.status}: ${await safeText(res)}`);
  }
  const payload = await res.json();
  const rawParts = payload?.candidates?.[0]?.content?.parts ?? [];
  const parts: Array<{ text?: string }> = Array.isArray(rawParts) ? rawParts : [];
  const text = parts
    .filter((p) => typeof p?.text === "string")
    .map((p) => p.text as string)
    .join("");
  const usage = payload?.usageMetadata ?? {};
  return {
    text,
    usage: {
      input_tokens: usage.promptTokenCount ?? 0,
      output_tokens: usage.candidatesTokenCount ?? 0,
    },
    stop_reason: payload?.candidates?.[0]?.finishReason ?? null,
    provider: "google",
    modelId,
  };
}

async function safeText(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 300) || res.statusText;
}
