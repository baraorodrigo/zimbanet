"use server";

// Hero da matéria (articles.hero_image_url): aplicar variação como capa, buscar
// da fonte, trocar por URL e subir do computador.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadAndStoreImage, storeImageBuffer } from "@/lib/storage-images";
import { requireStaff, type ApplyResult } from "./shared";

// ----------------------------------------------------------------
// Aplica a mídia escolhida como o HERO da matéria — escreve em
// articles.hero_image_url. Útil quando o admin curte uma variação
// específica gerada pro Instagram e quer usar a mesma como capa da
// matéria no portal. NÃO mexe nos social_posts.
// ----------------------------------------------------------------
export async function applyAsArticleHero(
  articleId: string,
  mediaUrl: string,
): Promise<ApplyResult> {
  if (!articleId) throw new Error("articleId ausente.");
  if (!mediaUrl) throw new Error("mediaUrl ausente.");
  const { supabase, user } = await requireStaff();

  const { data: prevRaw } = await supabase
    .from("articles")
    .select("hero_image_url")
    .eq("id", articleId)
    .maybeSingle();
  const previous = (prevRaw as { hero_image_url: string | null } | null)?.hero_image_url ?? null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("articles")
    .update({ hero_image_url: mediaUrl })
    .eq("id", articleId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "apply_as_article_hero",
    actor: user.email ?? user.id,
    agent: "admin_ui_estudio_studio",
    metadata: { new: mediaUrl, previous },
  });

  revalidatePath(`/admin/materias/${articleId}`);
  revalidatePath(`/admin/estudio/${articleId}`);
  revalidatePath("/admin/social");
  revalidatePath("/admin/materias");

  return { mediaUrl, previous };
}

// ----------------------------------------------------------------
// "Atualizar hero da fonte" — para o card de hero image da matéria.
// Busca raw_items.image_url (já scrapeado pelo radar) via scored_item_id
// e re-hospeda no bucket próprio, atualizando articles.hero_image_url.
// Usado pelo botão "Buscar da fonte" no Estúdio de Imagens em
// /admin/materias/[id], no fluxo "Redigir com IA".
// ----------------------------------------------------------------
export async function refreshArticleHeroFromSource(formData: FormData): Promise<void> {
  const articleId = formData.get("article_id");
  if (typeof articleId !== "string" || !articleId) {
    throw new Error("article_id ausente.");
  }
  const { supabase, user } = await requireStaff();

  const { data: artRaw } = await supabase
    .from("articles")
    .select("id, slug, scored_item_id, hero_image_url")
    .eq("id", articleId)
    .maybeSingle();
  const article = artRaw as {
    id: string;
    slug: string;
    scored_item_id: string | null;
    hero_image_url: string | null;
  } | null;
  if (!article) throw new Error("Matéria não encontrada.");
  if (!article.scored_item_id) {
    throw new Error(
      "Esta matéria não tem origem do motor IA (foi criada manual). Cole a URL no campo abaixo.",
    );
  }

  // Cadeia article → scored_item → raw_item.image_url
  const { data: scored } = await supabase
    .from("scored_items")
    .select("raw_item_id")
    .eq("id", article.scored_item_id)
    .maybeSingle();
  const rawId = (scored as { raw_item_id: string } | null)?.raw_item_id;
  if (!rawId) throw new Error("Não consegui rastrear o raw_item dessa matéria.");

  const { data: rawItem } = await supabase
    .from("raw_items")
    .select("image_url, url")
    .eq("id", rawId)
    .maybeSingle();
  const raw = rawItem as { image_url: string | null; url: string } | null;

  // Fallback: se raw_items.image_url tá null (radar não pegou), tenta
  // raspar og:image da página da fonte na hora.
  let imageUrl = raw?.image_url ?? null;
  let scrapedFromHtml = false;
  if (!imageUrl && raw?.url) {
    imageUrl = await scrapeOgImage(raw.url);
    scrapedFromHtml = !!imageUrl;
  }
  if (!imageUrl) {
    throw new Error(
      "A fonte original não trouxe imagem (nem no feed nem na og:image). Cole a URL manualmente.",
    );
  }

  const hosted = await downloadAndStoreImage(imageUrl, `hero/${article.slug}`);

  const admin = createAdminClient();
  const { error } = await admin
    .from("articles")
    .update({ hero_image_url: hosted })
    .eq("id", articleId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "refresh_hero_from_source",
    actor: user.email ?? user.id,
    agent: "admin_ui_materias_studio",
    metadata: {
      source: imageUrl,
      source_from_html: scrapedFromHtml,
      raw_url: raw?.url ?? null,
      hosted,
      previous: article.hero_image_url,
    },
  });

  revalidatePath(`/admin/materias/${articleId}`);
  revalidatePath("/admin/materias");
  revalidatePath(`/admin/estudio/${articleId}`);
}

// Raspa og:image (com fallback pra twitter:image e primeira <img>) da
// página HTML da fonte. Best-effort — pode falhar em sites com paywall
// ou JS-rendered.
async function scrapeOgImage(sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ZimbanetBot/1.0; +https://zimbanet.com)",
        accept: "text/html,application/xhtml+xml",
      },
      // 8s timeout — sites lentos não bloqueiam o admin
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const og = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    );
    if (og?.[1]) return absolutize(og[1], sourceUrl);

    const ogAlt = html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    );
    if (ogAlt?.[1]) return absolutize(ogAlt[1], sourceUrl);

    const tw = html.match(
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    );
    if (tw?.[1]) return absolutize(tw[1], sourceUrl);

    return null;
  } catch {
    return null;
  }
}

function absolutize(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

// "Trocar URL do hero" — admin cola uma URL externa, a gente baixa e
// re-hospeda. Mesma intenção do refresh-from-source mas com URL livre.
// ----------------------------------------------------------------
export async function setArticleHeroFromUrl(formData: FormData): Promise<void> {
  const articleId = formData.get("article_id");
  const newUrl = formData.get("url");
  if (typeof articleId !== "string" || !articleId) {
    throw new Error("article_id ausente.");
  }
  if (typeof newUrl !== "string" || !newUrl.trim()) {
    throw new Error("URL ausente.");
  }
  const trimmed = newUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("URL precisa começar com http:// ou https://.");
  }
  const { supabase, user } = await requireStaff();

  const { data: artRaw } = await supabase
    .from("articles")
    .select("slug, hero_image_url")
    .eq("id", articleId)
    .maybeSingle();
  const article = artRaw as { slug: string; hero_image_url: string | null } | null;
  if (!article) throw new Error("Matéria não encontrada.");

  const hosted = await downloadAndStoreImage(trimmed, `hero/${article.slug}`);

  const admin = createAdminClient();
  const { error } = await admin
    .from("articles")
    .update({ hero_image_url: hosted })
    .eq("id", articleId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "set_hero_from_url",
    actor: user.email ?? user.id,
    agent: "admin_ui_materias_studio",
    metadata: {
      source: trimmed,
      hosted,
      previous: article.hero_image_url,
    },
  });

  revalidatePath(`/admin/materias/${articleId}`);
  revalidatePath("/admin/materias");
}

// "Subir do computador" — admin envia arquivo do disco como hero da
// matéria. Mesmo fluxo do upload de social_post, mas grava em
// articles.hero_image_url.
// ----------------------------------------------------------------
export async function uploadArticleHeroFromForm(
  formData: FormData,
): Promise<{ heroImageUrl: string; previous: string | null }> {
  const articleId = formData.get("article_id");
  const file = formData.get("file");
  if (typeof articleId !== "string" || !articleId) {
    throw new Error("article_id ausente.");
  }
  if (!(file instanceof File)) throw new Error("Arquivo ausente.");
  if (!file.type.startsWith("image/")) {
    throw new Error("Só aceitamos imagem (PNG, JPG, WEBP).");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Imagem maior que 10 MB. Comprime antes de enviar.");
  }

  const { supabase, user } = await requireStaff();

  const { data: artRaw } = await supabase
    .from("articles")
    .select("slug, hero_image_url")
    .eq("id", articleId)
    .maybeSingle();
  const article = artRaw as { slug: string; hero_image_url: string | null } | null;
  if (!article) throw new Error("Matéria não encontrada.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const hosted = await storeImageBuffer({
    buffer,
    contentType: file.type,
    pathPrefix: `hero/${article.slug}/uploads`,
    filename: file.name,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("articles")
    .update({ hero_image_url: hosted })
    .eq("id", articleId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "upload_hero",
    actor: user.email ?? user.id,
    agent: "admin_ui_materias_studio",
    metadata: {
      filename: file.name,
      size: file.size,
      previous: article.hero_image_url,
      hosted,
    },
  });

  revalidatePath(`/admin/materias/${articleId}`);
  revalidatePath(`/admin/estudio/${articleId}`);
  revalidatePath("/admin/materias");

  return { heroImageUrl: hosted, previous: article.hero_image_url };
}
