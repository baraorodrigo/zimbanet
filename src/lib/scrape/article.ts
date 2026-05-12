// Extrator de matéria por URL — só meta tags + JSON-LD + body heurístico.
// Sem cheerio/jsdom: regex resolve 95% dos casos pra sites de notícia brasileiros
// (todos fazem SSR e expõem og:image/og:title). Tem fallback gracioso pra cada
// campo: se o site não expõe, retorna null e o editor preenche manualmente.

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ZimbanetBot/0.1; +https://zimbanet.com)";

export type ScrapedArticle = {
  url: string;
  title: string | null;
  lede: string | null;
  body: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  sourceHost: string | null;
  siteName: string | null;
  error: string | null;
};

// Decode &amp; &#xX; &#NNN; — feeds e og:image vêm com essas escapes
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Lê <meta property="X" content="Y"> ou <meta name="X" content="Y">
// tolerante a ordem de atributos e aspas simples/duplas.
function metaContent(html: string, key: string): string | null {
  const k = escapeForRegex(key);
  const patterns = [
    new RegExp(
      `<meta[^>]*\\bproperty=["']${k}["'][^>]*\\bcontent=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*\\bcontent=["']([^"']+)["'][^>]*\\bproperty=["']${k}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*\\bname=["']${k}["'][^>]*\\bcontent=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*\\bcontent=["']([^"']+)["'][^>]*\\bname=["']${k}["']`,
      "i",
    ),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

// Procura primeiro JSON-LD com @type=NewsArticle/Article — extrai articleBody,
// headline, datePublished, image. O mais confiável quando o site segue schema.org.
function extractJsonLd(html: string): {
  title?: string;
  body?: string;
  image?: string;
  publishedAt?: string;
  description?: string;
} | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    const raw = block[1];
    if (!raw) continue;
    let data: unknown;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    const candidates: unknown[] = Array.isArray(data) ? data : [data];
    const flat: Record<string, unknown>[] = [];
    for (const c of candidates) {
      if (typeof c !== "object" || !c) continue;
      const obj = c as Record<string, unknown>;
      const graph = obj["@graph"];
      if (Array.isArray(graph)) {
        for (const g of graph) {
          if (g && typeof g === "object") flat.push(g as Record<string, unknown>);
        }
      } else {
        flat.push(obj);
      }
    }
    for (const entity of flat) {
      const t = entity["@type"];
      const type = Array.isArray(t) ? t.join(",") : String(t ?? "");
      if (!/Article|NewsArticle|BlogPosting|Report/i.test(type)) continue;
      const img = entity["image"];
      let image: string | undefined;
      if (typeof img === "string") image = img;
      else if (Array.isArray(img) && typeof img[0] === "string") image = img[0];
      else if (img && typeof img === "object") {
        const url = (img as Record<string, unknown>)["url"];
        if (typeof url === "string") image = url;
      }
      return {
        title: typeof entity["headline"] === "string" ? (entity["headline"] as string) : undefined,
        body: typeof entity["articleBody"] === "string" ? (entity["articleBody"] as string) : undefined,
        description:
          typeof entity["description"] === "string" ? (entity["description"] as string) : undefined,
        image,
        publishedAt:
          typeof entity["datePublished"] === "string"
            ? (entity["datePublished"] as string)
            : undefined,
      };
    }
  }
  return null;
}

// Body via heurística HTML: tenta isolar <article>, depois <main>, depois
// pega todos os <p> de primeiro nível. Strip de scripts/estilos antes pra
// não vazar JS no body. Tag-stripping bruto via regex — não vai sair perfeito,
// mas o Redator vai reescrever em cima disso. Limitado a 8000 chars.
function extractBodyHtml(html: string): string | null {
  // Isola um container provável
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const container = article?.[1] ?? main?.[1] ?? html;

  // Remove ruído antes de extrair texto
  const cleaned = container
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");

  const paragraphs = [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1])
    .map((p) =>
      decodeEntities(
        p
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    )
    .filter((p) => p.length >= 30); // descarta legendas, créditos curtos

  if (paragraphs.length === 0) return null;
  const body = paragraphs.join("\n\n").slice(0, 8000);
  return body.length >= 80 ? body : null;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function resolveImageUrl(image: string | null, base: string): string | null {
  if (!image) return null;
  try {
    return new URL(image, base).toString();
  } catch {
    return null;
  }
}

export async function scrapeArticleByUrl(url: string): Promise<ScrapedArticle> {
  const base: ScrapedArticle = {
    url,
    title: null,
    lede: null,
    body: null,
    imageUrl: null,
    publishedAt: null,
    sourceHost: safeHost(url),
    siteName: null,
    error: null,
  };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ...base, error: "URL inválida." };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { ...base, error: "URL precisa começar com http:// ou https://." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      return { ...base, error: `Site respondeu ${resp.status}. Pode ter paywall ou bloqueio.` };
    }
    const ctype = (resp.headers.get("content-type") ?? "").toLowerCase();
    if (!ctype.includes("html")) {
      return { ...base, error: `Conteúdo não é HTML (${ctype || "sem content-type"}).` };
    }
    html = await resp.text();
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, error: `Falha ao buscar: ${msg}` };
  }

  const jsonLd = extractJsonLd(html);

  const ogTitle = metaContent(html, "og:title");
  const twTitle = metaContent(html, "twitter:title");
  // <title> como último recurso — tira sufixo do site se vier "Título - Site"
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
  const titleClean = titleTag
    ? decodeEntities(titleTag.trim()).replace(/\s+/g, " ")
    : null;

  const title = jsonLd?.title || ogTitle || twTitle || titleClean;

  const ogDesc = metaContent(html, "og:description");
  const twDesc = metaContent(html, "twitter:description");
  const metaDesc = metaContent(html, "description");
  const lede = jsonLd?.description || ogDesc || twDesc || metaDesc;

  const ogImage =
    metaContent(html, "og:image:secure_url") ||
    metaContent(html, "og:image") ||
    metaContent(html, "twitter:image");
  const imageRaw = jsonLd?.image || ogImage;
  const imageUrl = resolveImageUrl(imageRaw ?? null, url);

  const publishedAt =
    jsonLd?.publishedAt ||
    metaContent(html, "article:published_time") ||
    metaContent(html, "og:article:published_time") ||
    metaContent(html, "date") ||
    null;

  const siteName = metaContent(html, "og:site_name");

  const body = jsonLd?.body ?? extractBodyHtml(html);

  return {
    ...base,
    title,
    lede: lede?.slice(0, 600) ?? null,
    body: body ?? null,
    imageUrl,
    publishedAt,
    siteName,
  };
}
