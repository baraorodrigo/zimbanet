"use server";

// Upload genérico de imagem usado por todos os caminhos de criação de
// conteúdo (matérias admin, bazar guest, mural guest). Salva em bucket
// `social-cards/uploads/{scope}/` e retorna URL pública.
//
// Validações:
//   - tipo MIME: image/jpeg|png|webp|gif
//   - tamanho máx: 8 MB (suficiente pra foto de celular)
//
// Auth: aceita anônimo (community guest) — não exige requireStaff. O
// bucket é público; o storage path inclui scope pra organizar. Limita
// abuso pelo tamanho (admin pode trocar via env futuramente).

import { storeImageBuffer } from "@/lib/storage-images";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadImage(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file");
  const scopeRaw = formData.get("scope");
  if (!(file instanceof File)) {
    return { ok: false, error: "Arquivo ausente." };
  }
  if (file.size === 0) {
    return { ok: false, error: "Arquivo vazio." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Arquivo muito grande (máx 8 MB)." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Formato não suportado. Use JPG, PNG, WebP ou GIF.",
    };
  }

  // Scope vira segmento de path — só letras/dígitos/hífen pra evitar
  // path traversal (storage Supabase já filtra, mas defesa em profundidade).
  const scope =
    typeof scopeRaw === "string" && /^[a-z0-9-]{1,32}$/.test(scopeRaw)
      ? scopeRaw
      : "misc";

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const url = await storeImageBuffer({
      buffer,
      contentType: file.type,
      pathPrefix: `uploads/${scope}`,
      filename: file.name,
    });
    return { ok: true, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
