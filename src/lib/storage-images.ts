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

const BUCKET = "social-cards";
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024; // 15 MB — cobre foto de jornal sem virar bomba

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
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

// Bloqueia SSRF: localhost, IPs privados (RFC1918), link-local (inclui IMDS
// 169.254.169.254 da AWS/GCP), loopback IPv6.
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "0.0.0.0" || h === "::" || h === "::1" || h === "[::1]") return true;
  // IPv4 numérico
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const o = m.slice(1, 5).map((n) => parseInt(n, 10));
    if (o.some((n) => n < 0 || n > 255)) return true;
    // 10.0.0.0/8
    if (o[0] === 10) return true;
    // 127.0.0.0/8
    if (o[0] === 127) return true;
    // 169.254.0.0/16 (link-local, IMDS)
    if (o[0] === 169 && o[1] === 254) return true;
    // 172.16.0.0/12
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
    // 192.168.0.0/16
    if (o[0] === 192 && o[1] === 168) return true;
    // 0.0.0.0/8
    if (o[0] === 0) return true;
  }
  // IPv6 privado/loopback básico
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return true;
  return false;
}

function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`URL de imagem inválida: ${raw}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(`Protocolo não permitido: ${u.protocol}`);
  }
  // Em produção forçamos https
  if (process.env.NODE_ENV === "production" && u.protocol !== "https:") {
    throw new Error("Apenas https é aceito em produção");
  }
  if (isPrivateHost(u.hostname)) {
    throw new Error(`Host bloqueado (privado/loopback): ${u.hostname}`);
  }
  return u;
}

// Baixa de uma URL externa (Fal.ai, RSS source, etc) e sobe no nosso bucket.
// Retorna a URL pública estável.
export async function downloadAndStoreImage(
  sourceUrl: string,
  pathPrefix: string,
): Promise<string> {
  assertSafeUrl(sourceUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let res: Response;
  try {
    res = await fetch(sourceUrl, {
      headers: {
        // Algumas fontes regionais bloqueiam UA vazio; manda um agent neutro.
        "User-Agent": "ZIMBANET-Studio/1.0 (+https://zimbanet.com)",
      },
      signal: controller.signal,
      redirect: "follow",
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
      contentType: `image/${ext}`,
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
