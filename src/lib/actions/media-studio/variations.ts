"use server";

// Geração por IA: variações pro social, variações de hero, e o pacote inteiro.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImage, imageSizeForFormat } from "@/lib/ai/image";
import { coerceVisualSlots, buildPromptFromSlots } from "@/lib/visual-slots";
import {
  requireStaff,
  type GenResult,
  type HeroVariationsResult,
  type PackItem,
  type PackResult,
} from "./shared";

// ----------------------------------------------------------------
// Gera 4 variações pelo modelo configurado no slot "image". O provider
// (OpenRouter, Google, OpenAI ou Fal.ai) é resolvido em runtime e a imagem
// já é re-hospedada no bucket próprio pra ter URLs estáveis.
// ----------------------------------------------------------------
export async function generateVariations(
  articleId: string,
  socialPostId: string,
): Promise<GenResult> {
  if (!articleId || !socialPostId) throw new Error("IDs ausentes.");
  const { supabase, user } = await requireStaff();

  const { data: articleRaw } = await supabase
    .from("articles")
    .select("visual_slots, hero_image_url, slug")
    .eq("id", articleId)
    .maybeSingle();
  if (!articleRaw) throw new Error("Matéria não encontrada.");
  const article = articleRaw as {
    visual_slots: unknown;
    hero_image_url: string | null;
    slug: string;
  };

  const { data: postRaw } = await supabase
    .from("social_posts")
    .select("format")
    .eq("id", socialPostId)
    .maybeSingle();
  if (!postRaw) throw new Error("Post não encontrado.");
  const post = postRaw as { format: string };

  const slots = coerceVisualSlots(article.visual_slots);
  const prompt = buildPromptFromSlots(slots);
  const size = imageSizeForFormat(post.format);
  const heroUrl = article.hero_image_url;

  const t0 = Date.now();
  // O generateImage já re-hospeda no nosso bucket — não precisa baixar de novo.
  const { urls: variations } = await generateImage({
    prompt,
    size,
    num_images: 4,
    source_image_url: heroUrl ?? undefined,
    storagePrefix: `variations/${article.slug}`,
  });
  const elapsedMs = Date.now() - t0;

  await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: socialPostId,
    action: "generate_variations",
    actor: user.email ?? user.id,
    agent: "admin_ui_estudio_studio",
    metadata: {
      article_id: articleId,
      count: variations.length,
      prompt,
      size,
      used_redux: !!heroUrl,
      elapsed_ms: elapsedMs,
      variations,
    },
  });

  return { variations, prompt, used_redux: !!heroUrl };
}

// ----------------------------------------------------------------
// Gera 3 variações 16:9 pro HERO da matéria a partir de um prompt
// livre (editado pelo admin na tela de edição). NÃO aplica — só
// devolve as URLs pra preview; a aplicação é manual via applyAsArticleHero.
// Usa o hero atual como source (image-to-image) quando disponível,
// pra manter coerência visual nas iterações.
// ----------------------------------------------------------------
export async function generateHeroVariations(
  articleId: string,
  customPrompt: string,
): Promise<HeroVariationsResult> {
  try {
    if (!articleId) throw new Error("articleId ausente.");
    const prompt = (customPrompt ?? "").trim();
    if (prompt.length < 8) {
      return { ok: false, error: "Prompt muito curto — descreva a cena (mínimo 8 caracteres)." };
    }
    if (prompt.length > 2000) {
      return { ok: false, error: "Prompt acima de 2000 caracteres — encurte." };
    }
    const { supabase, user } = await requireStaff();

    const { data: articleRaw } = await supabase
      .from("articles")
      .select("hero_image_url, slug, title")
      .eq("id", articleId)
      .maybeSingle();
    const article = (articleRaw ?? null) as {
      hero_image_url: string | null;
      slug: string;
      title: string;
    } | null;
    if (!article) return { ok: false, error: "Matéria não encontrada." };

    const heroUrl = article.hero_image_url;
    const t0 = Date.now();
    const { urls, provider, modelId } = await generateImage({
      prompt,
      size: "landscape_16_9",
      num_images: 3,
      source_image_url: heroUrl ?? undefined,
      storagePrefix: `hero-ai/${article.slug}`,
    });
    const elapsedMs = Date.now() - t0;

    await supabase.from("audit_log").insert({
      entity_type: "article",
      entity_id: articleId,
      action: "generate_hero_variations",
      actor: user.email ?? user.id,
      agent: "admin_ui_materias_hero_ai",
      metadata: {
        prompt,
        used_source: !!heroUrl,
        count: urls.length,
        provider,
        model: modelId,
        elapsed_ms: elapsedMs,
        urls,
      },
    });

    return { ok: true, urls, prompt, used_source: !!heroUrl, modelId, provider };
  } catch (err) {
    console.error("[generateHeroVariations]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ----------------------------------------------------------------
// Gera o PACOTE inteiro: 1 imagem por canvas do social_posts + 1 hero
// 16:9 pra articles.hero_image_url. Cada canvas usa seu próprio tamanho
// (IG feed = quadrado, stories = vertical, FB = horizontal). Aplica TODAS
// automaticamente — substitui media_url dos posts e hero_image_url do
// article. Erros por canvas não derrubam o pacote inteiro.
// ----------------------------------------------------------------
export async function generatePack(articleId: string): Promise<PackResult> {
  if (!articleId) throw new Error("articleId ausente.");
  const { supabase, user } = await requireStaff();

  const { data: articleRaw } = await supabase
    .from("articles")
    .select("visual_slots, hero_image_url, slug")
    .eq("id", articleId)
    .maybeSingle();
  if (!articleRaw) throw new Error("Matéria não encontrada.");
  const article = articleRaw as {
    visual_slots: unknown;
    hero_image_url: string | null;
    slug: string;
  };

  const { data: postsRaw } = await supabase
    .from("social_posts")
    .select("id, channel, format")
    .eq("article_id", articleId)
    .neq("status", "failed");
  const posts = (postsRaw ?? []) as Array<{
    id: string;
    channel: string;
    format: string;
  }>;

  const slots = coerceVisualSlots(article.visual_slots);
  const prompt = buildPromptFromSlots(slots);
  const heroUrl = article.hero_image_url;
  const admin = createAdminClient();
  const items: PackItem[] = [];
  const errors: PackResult["errors"] = [];
  const t0 = Date.now();

  // Posts sociais — 1 imagem cada, no tamanho nativo do formato. Em paralelo.
  const socialJobs = posts
    .filter((p) => p.format !== "text_only")
    .map(async (p) => {
      try {
        const size = imageSizeForFormat(p.format);
        const { urls } = await generateImage({
          prompt,
          size,
          num_images: 1,
          source_image_url: heroUrl ?? undefined,
          storagePrefix: `pack/${article.slug}/${p.channel}`,
        });
        const url = urls[0];
        if (!url) throw new Error("Provider não devolveu URL.");
        const { error: updErr } = await admin
          .from("social_posts")
          .update({ media_url: url, status: "ready" })
          .eq("id", p.id);
        if (updErr) throw new Error(updErr.message);
        items.push({
          scope: "social_post",
          socialPostId: p.id,
          channel: p.channel,
          format: p.format,
          mediaUrl: url,
          size,
        });
      } catch (err) {
        errors.push({
          scope: "social_post",
          label: `${p.channel}/${p.format}`,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

  // Hero da matéria — 16:9 landscape pra entrar em articles.hero_image_url.
  const heroJob = (async () => {
    try {
      const { urls } = await generateImage({
        prompt,
        size: "landscape_16_9",
        num_images: 1,
        source_image_url: heroUrl ?? undefined,
        storagePrefix: `pack/${article.slug}/hero`,
      });
      const url = urls[0];
      if (!url) throw new Error("Provider não devolveu URL.");
      const { error: updErr } = await admin
        .from("articles")
        .update({ hero_image_url: url })
        .eq("id", articleId);
      if (updErr) throw new Error(updErr.message);
      items.push({
        scope: "article_hero",
        mediaUrl: url,
        size: "landscape_16_9",
      });
    } catch (err) {
      errors.push({
        scope: "article_hero",
        label: "hero da matéria",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  await Promise.all([...socialJobs, heroJob]);
  const elapsedMs = Date.now() - t0;

  await supabase.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "generate_pack",
    actor: user.email ?? user.id,
    agent: "admin_ui_estudio_studio",
    metadata: {
      prompt,
      used_redux: !!heroUrl,
      count_ok: items.length,
      count_err: errors.length,
      elapsed_ms: elapsedMs,
      items,
      errors,
    },
  });

  revalidatePath(`/admin/estudio/${articleId}`);
  revalidatePath(`/admin/materias/${articleId}`);
  revalidatePath("/admin/social");

  return { prompt, used_redux: !!heroUrl, items, errors };
}
