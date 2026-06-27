// Helpers de storage pra mídia do Estúdio. Centraliza:
//   - download de URL externa + reupload pro bucket próprio (evita hotlink)
//   - upload direto de Buffer
//
// Bucket padrão: social-cards (mesmo usado pelos cards renderizados via
// Puppeteer). Caminhos:
//   variations/<slug>/<timestamp>-<rand>.<ext>
//   source/<slug>/<timestamp>-<rand>.<ext>
//   uploads/<social_post_id>-<timestamp>.<ext>

import { createAdminClient } from "@/lib/supabase/admin";
import { safeFetch } from "@/lib/net/safe-fetch";

const BUCKET = "social-cards";
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024; // 15 MB — cobre foto de jornal sem virar bomba

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpeg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpeg";
}

// O bucket do Supabase aceita os MIME padrão. "image/jpg" NÃO é padrão (o certo
// é "image/jpeg") e era rejeitado -> matéria publicava sem foto. Normaliza.
function normalizeImageMime(ct: string): string {
  return ct.trim().toLowerCase() === "image/jpg" ? "image/jpeg" : ct;
}

function videoExtFromContentType(ct: string | null): string {
  if (!ct) return "mp4";
  if (ct.includes("webm")) return "webm";
  if (ct.includes("quicktime") || ct.includes("mov")) return "mov";
  return "mp4";
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

// Proteção SSRF (host check privado/IMDS + redirect manual revalidado) vive em
// @/lib/net/safe-fetch e é aplicada via safeFetch() abaixo.

// Baixa de uma URL externa (Fal.ai, RSS source, etc) e sobe no nosso bucket.
// Retorna a URL pública estável.
export async function downloadAndStoreImage(
  sourceUrl: string,
  pathPrefix: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let res: Response;
  try {
    // safeFetch valida o host + segue redirects revalidando cada hop (anti-SSRF).
    res = await safeFetch(sourceUrl, {
      headers: {
        // Algumas fontes regionais bloqueiam UA vazio; manda um agent neutro.
        "User-Agent": "ZIMBANET-Studio/1.0 (+https://zimbanet.com)",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`Falha ao baixar imagem (${res.status}): ${sourceUrl}`);
  }

  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.toLowerCase().startsWith("image/")) {
    throw new Error(`Content-type não é imagem: ${ctype}`);
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Imagem maior que o limite (${ab.byteLength} > ${MAX_DOWNLOAD_BYTES})`);
  }
  const buf = Buffer.from(ab);
  const ext = extFromContentType(ctype);
  const stamp = Date.now();
  const path = `${pathPrefix}/${stamp}-${shortId()}.${ext}`;

  const supabase = createAdminClient();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: normalizeImageMime(`image/${ext}`),
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) {
    throw new Error(`Upload no Storage falhou: ${upErr.message}`);
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

// Upload direto de buffer (usado pelo upload manual do admin).
export async function storeImageBuffer(args: {
  buffer: Buffer;
  contentType: string;
  pathPrefix: string;
  filename?: string;
}): Promise<string> {
  const ext = extFromContentType(args.contentType);
  const contentType = normalizeImageMime(args.contentType);
  const stamp = Date.now();
  const safeName = args.filename
    ? args.filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 48)
    : shortId();
  const path = `${args.pathPrefix}/${stamp}-${safeName}.${ext}`;

  const supabase = createAdminClient();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, args.buffer, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) {
    throw new Error(`Upload no Storage falhou: ${upErr.message}`);
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

// Mesmo bucket das imagens (`social-cards`) — segmento `uploads/video/<scope>/`
// pra organizar. Cache longo: o nome do arquivo já tem timestamp+id, então
// não há colisão e o browser pode cachear permanentemente.
export async function storeVideoBuffer(args: {
  buffer: Buffer;
  contentType: string;
  pathPrefix: string;
  filename?: string;
}): Promise<string> {
  const ext = videoExtFromContentType(args.contentType);
  const stamp = Date.now();
  const safeName = args.filename
    ? args.filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 48)
    : shortId();
  const path = `${args.pathPrefix}/${stamp}-${safeName}.${ext}`;

  const supabase = createAdminClient();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, args.buffer, {
      contentType: args.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) {
    throw new Error(`Upload no Storage falhou: ${upErr.message}`);
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}
