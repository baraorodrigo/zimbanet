"use server";

// Mídia dos social_posts: aplicar variação, buscar da fonte, aplicar o hero em
// todos, subir do computador e limpar a mídia.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadAndStoreImage, storeImageBuffer } from "@/lib/storage-images";
import { requireStaff, type ApplyResult } from "./shared";

// ----------------------------------------------------------------
// Aplica uma variação como media_url oficial do post.
// Move o status pra "ready" e loga a troca pra possibilitar undo
// na Fase D (history-studio).
// ----------------------------------------------------------------
export async function applyVariation(
  socialPostId: string,
  mediaUrl: string,
): Promise<ApplyResult> {
  if (!socialPostId) throw new Error("socialPostId ausente.");
  if (!mediaUrl) throw new Error("mediaUrl ausente.");
  const { supabase, user } = await requireStaff();

  const { data: prevRaw } = await supabase
    .from("social_posts")
    .select("article_id, media_url")
    .eq("id", socialPostId)
    .maybeSingle();
  const prev = (prevRaw ?? null) as { article_id: string; media_url: string | null } | null;

  // Bypass RLS via admin client — mesma estratégia do /api/social/render.
  const admin = createAdminClient();
  const { error } = await admin
    .from("social_posts")
    .update({ media_url: mediaUrl, status: "ready" })
    .eq("id", socialPostId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: socialPostId,
    action: "apply_variation",
    actor: user.email ?? user.id,
    agent: "admin_ui_estudio_studio",
    metadata: {
      new: mediaUrl,
      previous: prev?.media_url ?? null,
    },
  });

  if (prev?.article_id) {
    revalidatePath(`/admin/estudio/${prev.article_id}`);
  }
  revalidatePath("/admin/social");

  return { mediaUrl, previous: prev?.media_url ?? null };
}

// "Da fonte" — copia o hero_image_url da matéria pro post.
// Re-hospeda pra evitar problemas de hotlink/CORS depois.
// ----------------------------------------------------------------
export async function fetchSourceImage(
  articleId: string,
  socialPostId: string,
): Promise<ApplyResult> {
  if (!articleId || !socialPostId) throw new Error("IDs ausentes.");
  const { supabase, user } = await requireStaff();

  const { data: articleRaw } = await supabase
    .from("articles")
    .select("hero_image_url, slug")
    .eq("id", articleId)
    .maybeSingle();
  const article = (articleRaw ?? null) as {
    hero_image_url: string | null;
    slug: string;
  } | null;

  if (!article?.hero_image_url) {
    throw new Error("A matéria não tem imagem de origem (hero_image_url).");
  }

  const mediaUrl = await downloadAndStoreImage(
    article.hero_image_url,
    `source/${article.slug}`,
  );

  const { data: prevRaw } = await supabase
    .from("social_posts")
    .select("media_url")
    .eq("id", socialPostId)
    .maybeSingle();
  const previous = (prevRaw as { media_url: string | null } | null)?.media_url ?? null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("social_posts")
    .update({ media_url: mediaUrl, status: "ready" })
    .eq("id", socialPostId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: socialPostId,
    action: "fetch_source_image",
    actor: user.email ?? user.id,
    agent: "admin_ui_estudio_studio",
    metadata: {
      source: article.hero_image_url,
      hosted: mediaUrl,
      previous,
    },
  });

  revalidatePath(`/admin/estudio/${articleId}`);
  revalidatePath("/admin/social");

  return { mediaUrl, previous };
}

// "Aplica esse hero em todos os cards" — usa o hero_image_url da matéria
// como media_url de TODOS os social_posts não-text_only (e não-published).
// Re-hospeda uma vez só e reusa a mesma URL nos posts. Posts que já têm
// foto são sobrescritos.
// ----------------------------------------------------------------
export async function applyHeroToAllSocialPosts(
  articleId: string,
): Promise<{ applied: number; skipped: number; hostedUrl: string }> {
  if (!articleId) throw new Error("articleId ausente.");
  const { supabase, user } = await requireStaff();

  const { data: artRaw } = await supabase
    .from("articles")
    .select("hero_image_url, slug")
    .eq("id", articleId)
    .maybeSingle();
  const article = artRaw as { hero_image_url: string | null; slug: string } | null;
  if (!article) throw new Error("Matéria não encontrada.");
  if (!article.hero_image_url) {
    throw new Error("A matéria ainda não tem hero — sobe ou gera uma foto primeiro.");
  }

  const { data: postsRaw } = await supabase
    .from("social_posts")
    .select("id, format, status, media_url")
    .eq("article_id", articleId);
  const posts = (postsRaw ?? []) as Array<{
    id: string;
    format: string;
    status: string;
    media_url: string | null;
  }>;

  const targets = posts.filter(
    (p) => p.format !== "text_only" && p.status !== "published",
  );
  const skipped = posts.length - targets.length;

  // Re-hospeda uma vez só — todos os posts apontam pra mesma URL estável.
  const hostedUrl = await downloadAndStoreImage(
    article.hero_image_url,
    `hero-apply/${article.slug}`,
  );

  const admin = createAdminClient();
  let applied = 0;
  for (const p of targets) {
    const { error } = await admin
      .from("social_posts")
      .update({ media_url: hostedUrl, status: "ready" })
      .eq("id", p.id);
    if (!error) applied++;
  }

  await supabase.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "apply_hero_to_all_social_posts",
    actor: user.email ?? user.id,
    agent: "admin_ui_materias_studio",
    metadata: {
      hero: article.hero_image_url,
      hosted: hostedUrl,
      applied,
      skipped,
      total_posts: posts.length,
    },
  });

  revalidatePath(`/admin/materias/${articleId}`);
  revalidatePath(`/admin/estudio/${articleId}`);
  revalidatePath("/admin/social");

  return { applied, skipped, hostedUrl };
}

// ----------------------------------------------------------------
// Upload manual via FormData — admin escolhe arquivo no disco.
// ----------------------------------------------------------------
export async function uploadMediaFromForm(formData: FormData): Promise<ApplyResult> {
  const socialPostId = formData.get("social_post_id");
  const file = formData.get("file");
  if (typeof socialPostId !== "string" || !socialPostId) {
    throw new Error("social_post_id ausente.");
  }
  if (!(file instanceof File)) throw new Error("Arquivo ausente.");
  if (!file.type.startsWith("image/")) {
    throw new Error("Só aceitamos imagem (PNG, JPG, WEBP).");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Imagem maior que 10 MB. Comprime antes de enviar.");
  }

  const { supabase, user } = await requireStaff();

  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaUrl = await storeImageBuffer({
    buffer,
    contentType: file.type,
    pathPrefix: `uploads/${socialPostId}`,
    filename: file.name,
  });

  const { data: prevRaw } = await supabase
    .from("social_posts")
    .select("article_id, media_url")
    .eq("id", socialPostId)
    .maybeSingle();
  const prev = (prevRaw ?? null) as { article_id: string; media_url: string | null } | null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("social_posts")
    .update({ media_url: mediaUrl, status: "ready" })
    .eq("id", socialPostId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: socialPostId,
    action: "upload_image",
    actor: user.email ?? user.id,
    agent: "admin_ui_estudio_studio",
    metadata: {
      filename: file.name,
      size: file.size,
      previous: prev?.media_url ?? null,
      hosted: mediaUrl,
    },
  });

  if (prev?.article_id) {
    revalidatePath(`/admin/estudio/${prev.article_id}`);
  }
  revalidatePath("/admin/social");

  return { mediaUrl, previous: prev?.media_url ?? null };
}

// ----------------------------------------------------------------
// Apaga só a mídia do post — zera media_url e volta status pra
// pending pra forçar uma nova mídia/aprovação. NÃO descarta o post
// (legenda e hashtags ficam). Útil quando admin curtiu o texto mas
// não a imagem.
// ----------------------------------------------------------------
export async function clearPostMedia(socialPostId: string): Promise<ApplyResult> {
  if (!socialPostId) throw new Error("socialPostId ausente.");
  const { supabase, user } = await requireStaff();

  const { data: prevRaw } = await supabase
    .from("social_posts")
    .select("article_id, media_url")
    .eq("id", socialPostId)
    .maybeSingle();
  const prev = (prevRaw ?? null) as { article_id: string; media_url: string | null } | null;
  if (!prev) throw new Error("Post não encontrado.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("social_posts")
    .update({ media_url: null, status: "pending" })
    .eq("id", socialPostId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: socialPostId,
    action: "clear_media",
    actor: user.email ?? user.id,
    agent: "admin_ui_estudio_studio",
    metadata: { previous: prev.media_url },
  });

  if (prev.article_id) {
    revalidatePath(`/admin/estudio/${prev.article_id}`);
    revalidatePath(`/admin/materias/${prev.article_id}`);
  }
  revalidatePath("/admin/social");

  return { mediaUrl: "", previous: prev.media_url };
}
