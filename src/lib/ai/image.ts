// generateImage: dispatch de geração de imagem pelo provider do slot.
// Substitui o antigo falGenerate. Retorna URLs já hospedadas no nosso
// bucket (sempre re-hospeda; output original do provider é volátil).
//
// Cada provider devolve a imagem de um jeito diferente:
//   - OpenRouter (chat/completions com modalities: ["image","text"]) → base64
//     em choices[0].message.images[0].image_url.url
//   - OpenAI (POST /images/generations gpt-image-1) → data[0].b64_json
//   - Google AI (Gemini Nano Banana direto) → inlineData.data base64
//   - Fal.ai (POST fal.run/<model>) → images[].url hospedada no Fal
//
// Caller só vê: { variations: string[], prompt, used_redux }.

import { resolveSlot } from "./resolve";
import { downloadAndStoreImage, storeImageBuffer } from "@/lib/storage-images";

export type ImageSizeAlias =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "portrait_9_16"
  | "landscape_4_3"
  | "landscape_16_9";

const FORMAT_TO_SIZE: Record<string, ImageSizeAlias> = {
  card_1080: "square_hd",
  carousel_slide: "square_hd",
  banner_1200x630: "landscape_16_9",
  story_1080x1920: "portrait_9_16",
  text_only: "square_hd",
};

export function imageSizeForFormat(format: string): ImageSizeAlias {
  return FORMAT_TO_SIZE[format] ?? "square_hd";
}

// Cada provider tem seu próprio dialeto de "size". Mapeio o alias pra
// o que cada um aceita.
const SIZE_FAL: Record<ImageSizeAlias, string> = {
  square_hd: "square_hd",
  square: "square",
  portrait_4_3: "portrait_4_3",
  portrait_16_9: "portrait_16_9",
  portrait_9_16: "portrait_9_16",
  landscape_4_3: "landscape_4_3",
  landscape_16_9: "landscape_16_9",
};

const SIZE_OPENAI: Record<ImageSizeAlias, string> = {
  square_hd: "1024x1024",
  square: "1024x1024",
  portrait_4_3: "1024x1024",
  portrait_16_9: "1024x1024",
  portrait_9_16: "1024x1792",
  landscape_4_3: "1024x1024",
  landscape_16_9: "1792x1024",
};

export type GenerateImageOptions = {
  prompt: string;
  size?: ImageSizeAlias;
  num_images?: number;
  seed?: number;
  // Image-to-image quando informado (varia/refina hero existente).
  source_image_url?: string;
  // Onde re-hospedar (path prefix dentro do bucket social-cards).
  storagePrefix?: string;
};

export type GenerateImageResult = {
  /** URLs já hospedadas no nosso bucket. */
  urls: string[];
  provider: string;
  modelId: string;
};

export async function generateImage(
  opts: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const { provider, modelId, apiKey } = await resolveSlot("image");
  const count = Math.max(1, Math.min(4, opts.num_images ?? 4));
  const size = opts.size ?? "square_hd";
  const prefix = opts.storagePrefix ?? "variations/misc";

  if (provider === "fal") {
    // Fal aceita num_images=4 numa chamada só
    return await runFal(apiKey, modelId, { ...opts, num_images: count, size }, prefix);
  }

  if (provider === "openai") {
    return await runOpenAI(apiKey, modelId, { ...opts, num_images: count, size }, prefix);
  }

  if (provider === "openrouter") {
    // OpenRouter Nano Banana = 1 por chamada → fan-out em paralelo
    const urls = await runFanOut(count, () =>
      runOpenRouterGemini(apiKey, modelId, { ...opts, size }, prefix),
    );
    return { urls, provider, modelId };
  }

  if (provider === "google") {
    const urls = await runFanOut(count, () =>
      runGoogleGemini(apiKey, modelId, { ...opts, size }, prefix),
    );
    return { urls, provider, modelId };
  }

  throw new Error(`Provider ${provider} não suporta imagem (ou não implementado ainda).`);
}

// === Fan-out helper =========================================================

async function runFanOut(count: number, work: () => Promise<string>): Promise<string[]> {
  return await Promise.all(Array.from({ length: count }, () => work()));
}

// === OpenRouter (Gemini Nano Banana) =========================================
// Doc: POST /api/v1/chat/completions com modalities ["image","text"].
// Response: choices[0].message.images[0].image_url.url (data:image/png;base64,...)

async function runOpenRouterGemini(
  apiKey: string,
  modelId: string,
  opts: GenerateImageOptions,
  prefix: string,
): Promise<string> {
  const userParts: Array<Record<string, unknown>> = [{ type: "text", text: opts.prompt }];
  if (opts.source_image_url) {
    userParts.unshift({
      type: "image_url",
      image_url: { url: opts.source_image_url },
    });
  }

  const body = {
    model: modelId,
    modalities: ["image", "text"],
    messages: [{ role: "user", content: userParts }],
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "http-referer": "https://zimbanet.com",
      "x-title": "ZIMBANET",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await safeText(res)}`);
  }
  const payload = await res.json();
  const dataUrl: string | undefined =
    payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) {
    throw new Error("OpenRouter não retornou imagem (modelo pode ter rejeitado o prompt).");
  }
  return await storeDataUrl(dataUrl, prefix);
}

// === OpenAI gpt-image-1 =====================================================
// Doc: POST /v1/images/generations. Response: data[].b64_json.

async function runOpenAI(
  apiKey: string,
  modelId: string,
  opts: GenerateImageOptions,
  prefix: string,
): Promise<GenerateImageResult> {
  const body = {
    model: modelId,
    prompt: opts.prompt,
    n: opts.num_images ?? 1,
    size: SIZE_OPENAI[opts.size ?? "square_hd"],
    response_format: "b64_json",
  };
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await safeText(res)}`);
  }
  const payload = await res.json();
  const items: Array<{ b64_json?: string }> = Array.isArray(payload?.data) ? payload.data : [];
  if (!items.length) {
    throw new Error("OpenAI não retornou imagens.");
  }
  const urls = await Promise.all(
    items
      .filter((i) => typeof i.b64_json === "string")
      .map((i) => storeBase64(i.b64_json as string, "image/png", prefix)),
  );
  return { urls, provider: "openai", modelId };
}

// === Google AI (Gemini direto) =============================================
// Doc: models/<id>:generateContent. Response: candidates[0].content.parts[].inlineData

async function runGoogleGemini(
  apiKey: string,
  modelId: string,
  opts: GenerateImageOptions,
  prefix: string,
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [{ text: opts.prompt }];
  if (opts.source_image_url) {
    // Baixa a referência e manda inline (Gemini Vision aceita inlineData)
    const r = await fetch(opts.source_image_url);
    if (!r.ok) throw new Error(`Falha ao baixar source_image: ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    parts.unshift({
      inlineData: {
        mimeType: r.headers.get("content-type") ?? "image/jpeg",
        data: buf.toString("base64"),
      },
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
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
  const respParts: Array<{ inlineData?: { data?: string; mimeType?: string } }> =
    Array.isArray(rawParts) ? rawParts : [];
  const inline = respParts.find((p) => p?.inlineData?.data);
  if (!inline?.inlineData?.data) {
    throw new Error("Gemini não retornou imagem.");
  }
  const mime: string = inline.inlineData.mimeType ?? "image/png";
  return await storeBase64(inline.inlineData.data, mime, prefix);
}

// === Fal.ai (Flux) ==========================================================

async function runFal(
  apiKey: string,
  modelId: string,
  opts: GenerateImageOptions,
  prefix: string,
): Promise<GenerateImageResult> {
  const useRedux = !!opts.source_image_url;
  // Quando há imagem de referência, troca pro redux (i2i) automaticamente.
  // Permite o admin escolher schnell no painel mas ainda fazer i2i quando há hero.
  const endpointModel = useRedux ? "fal-ai/flux/redux" : modelId;

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    image_size: SIZE_FAL[opts.size ?? "square_hd"],
    num_images: Math.min(4, Math.max(1, opts.num_images ?? 4)),
    enable_safety_checker: true,
  };
  if (typeof opts.seed === "number") body.seed = opts.seed;
  if (useRedux) body.image_url = opts.source_image_url;

  const res = await fetch(`https://fal.run/${endpointModel}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Fal.ai ${res.status}: ${await safeText(res)}`);
  }
  const payload = await res.json();
  const images: Array<{ url: string }> = Array.isArray(payload?.images) ? payload.images : [];
  if (!images.length) throw new Error("Fal.ai não retornou imagens.");

  const urls = await Promise.all(
    images.map((img) => downloadAndStoreImage(img.url, prefix)),
  );
  return { urls, provider: "fal", modelId };
}

// === Helpers de storage =====================================================

async function storeDataUrl(dataUrl: string, prefix: string): Promise<string> {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Provider retornou data URL inválida.");
  return await storeBase64(m[2], m[1], prefix);
}

async function storeBase64(
  b64: string,
  contentType: string,
  prefix: string,
): Promise<string> {
  const buffer = Buffer.from(b64, "base64");
  return await storeImageBuffer({
    buffer,
    contentType,
    pathPrefix: prefix,
  });
}

async function safeText(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 300) || res.statusText;
}
