"use server";

// Server actions de mídia do Estúdio.
// Cobrem os 3 caminhos de origem de imagem:
//   - generate  -> modelo configurado no slot "image" → 4 variações
//   - source    -> hero_image_url da matéria → re-hospeda no nosso bucket
//   - upload    -> arquivo do admin (FormData)
// Plus apply (escolha qual variação vira a media_url do social_post).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/auth/admin";
import { generateImage, imageSizeForFormat } from "@/lib/ai/image";
import { downloadAndStoreImage, storeImageBuffer } from "@/lib/storage-images";
import { coerceVisualSlots, buildPromptFromSlots } from "@/lib/visual-slots";

type GenResult = {
  variations: string[];
  prompt: string;
  used_redux: boolean;
};

type ApplyResult = {
  mediaUrl: string;
  previous: string | null;
};

export type HeroVariationsResult =
  | { ok: true; urls: string[]; prompt: string; used_source: boolean; modelId: string; provider: string }
  | { ok: false; error: string };

type PackItem = {
  scope: "social_post" | "article_hero";
  socialPostId?: string;
  channel?: string;
  format?: string;
  mediaUrl: string;
  size: string;
};

type PackResult = {
  prompt: string;
  used_redux: boolean;
  items: PackItem[];
  errors: { scope: string; label: string; error: string }[];
};

async function requireStaff() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) throw new Error("Sem permissão.");
  return { supabase, user: user! };
}

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

type TemplateResult = {
  applied: number;
  skipped: number;
  errors: { channel: string; format: string; error: string }[];
};

// Mapa DB format → social-template route. carousel_slide e text_only ficam
// de fora: o primeiro reusa o card-1080 (slide quadrado), o segundo não
// tem imagem nenhuma.
function templateRouteForFormat(format: string): "card-1080" | "story-1080x1920" | "banner-1200x630" | null {
  if (format === "card_1080" || format === "carousel_slide") return "card-1080";
  if (format === "story_1080x1920") return "story-1080x1920";
  if (format === "banner_1200x630") return "banner-1200x630";
  return null;
}

function originForRender(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Dev: o painel costuma rodar em 3000/3100. PORT é setado pelo next dev.
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

// ----------------------------------------------------------------
// "Aplicar template do social kit" — NÃO gera imagem nova com IA.
// Pega o hero atual da matéria + textos (kicker/título/editoria) e renderiza
// cada canvas no template oficial (card 1080, story 9:16, banner 1200×630)
// via Puppeteer no /api/social/render. Resultado vira media_url de cada
// social_post não-text_only. Sem fricção: roda mesmo quando a matéria não
// tem hero (template tem fallback gráfico).
// ----------------------------------------------------------------
export async function applySocialKitTemplate(
  articleId: string,
): Promise<TemplateResult> {
  if (!articleId) throw new Error("articleId ausente.");
  const { supabase, user } = await requireStaff();

  const { data: articleRaw } = await supabase
    .from("articles")
    .select("title, kicker, subtitle, editoria, slug, hero_image_url, hero_image_credit")
    .eq("id", articleId)
    .maybeSingle();
  if (!articleRaw) throw new Error("Matéria não encontrada.");
  const article = articleRaw as {
    title: string;
    kicker: string | null;
    subtitle: string | null;
    editoria: string;
    slug: string;
    hero_image_url: string | null;
    hero_image_credit: string | null;
  };

  const { data: postsRaw } = await supabase
    .from("social_posts")
    .select("id, channel, format, status")
    .eq("article_id", articleId)
    .neq("status", "published");
  const posts = (postsRaw ?? []) as Array<{
    id: string;
    channel: string;
    format: string;
    status: string;
  }>;

  const origin = originForRender();
  const token = process.env.RENDER_API_TOKEN || "";
  const errors: TemplateResult["errors"] = [];
  let applied = 0;
  let skipped = 0;

  const t0 = Date.now();
  // Roda em paralelo — cada canvas é independente. Erros não derrubam o lote.
  await Promise.all(
    posts.map(async (p) => {
      const route = templateRouteForFormat(p.format);
      if (!route) {
        skipped++;
        return;
      }
      try {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (token) headers["x-render-token"] = token;
        const res = await fetch(`${origin}/api/social/render`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            format: route,
            social_post_id: p.id,
            article_slug: article.slug,
            params: {
              kicker: article.kicker ?? "ZIMBANET",
              headline: article.title,
              subline: article.subtitle ?? "",
              editoria: article.editoria,
              photo: article.hero_image_url ?? "",
              credit: article.hero_image_credit ?? "",
            },
          }),
          cache: "no-store",
        });
        if (!res.ok && res.status !== 207) {
          const text = await res.text().catch(() => "");
          throw new Error(`render ${res.status}: ${text.slice(0, 240)}`);
        }
        applied++;
      } catch (err) {
        errors.push({
          channel: p.channel,
          format: p.format,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
  const elapsedMs = Date.now() - t0;

  await supabase.from("audit_log").insert({
    entity_type: "article",
    entity_id: articleId,
    action: "apply_social_kit_template",
    actor: user.email ?? user.id,
    agent: "admin_ui_materias_social_panel",
    metadata: {
      applied,
      skipped,
      errors,
      elapsed_ms: elapsedMs,
      had_hero: !!article.hero_image_url,
    },
  });

  revalidatePath(`/admin/materias/${articleId}`);
  revalidatePath(`/admin/estudio/${articleId}`);
  revalidatePath("/admin/social");

  return { applied, skipped, errors };
}

// "Aplica template em um post só" — versão single-canvas do
// applySocialKitTemplate. Usado pelo botão "↺ Template" de cada PostCard
// quando o admin quer regerar só uma peça depois de mexer no título.
// ----------------------------------------------------------------
export async function applySocialKitTemplateToPost(
  socialPostId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!socialPostId) throw new Error("socialPostId ausente.");
  const { supabase, user } = await requireStaff();

  const { data: postRaw } = await supabase
    .from("social_posts")
    .select("article_id, channel, format")
    .eq("id", socialPostId)
    .maybeSingle();
  const post = postRaw as { article_id: string; channel: string; format: string } | null;
  if (!post) throw new Error("Post não encontrado.");

  const route = templateRouteForFormat(post.format);
  if (!route) {
    return { ok: false, error: "Esse formato não tem template (text_only não tem imagem)." };
  }

  const { data: articleRaw } = await supabase
    .from("articles")
    .select("title, kicker, subtitle, editoria, slug, hero_image_url, hero_image_credit")
    .eq("id", post.article_id)
    .maybeSingle();
  if (!articleRaw) throw new Error("Matéria não encontrada.");
  const article = articleRaw as {
    title: string;
    kicker: string | null;
    subtitle: string | null;
    editoria: string;
    slug: string;
    hero_image_url: string | null;
    hero_image_credit: string | null;
  };

  const origin = originForRender();
  const token = process.env.RENDER_API_TOKEN || "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["x-render-token"] = token;

  let res: Response;
  try {
    res = await fetch(`${origin}/api/social/render`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        format: route,
        social_post_id: socialPostId,
        article_slug: article.slug,
        params: {
          kicker: article.kicker ?? "ZIMBANET",
          headline: article.title,
          subline: article.subtitle ?? "",
          editoria: article.editoria,
          photo: article.hero_image_url ?? "",
          credit: article.hero_image_credit ?? "",
        },
      }),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok && res.status !== 207) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `render ${res.status}: ${text.slice(0, 240)}` };
  }

  await supabase.from("audit_log").insert({
    entity_type: "social_post",
    entity_id: socialPostId,
    action: "apply_social_kit_template_post",
    actor: user.email ?? user.id,
    agent: "admin_ui_materias_social_panel",
    metadata: {
      channel: post.channel,
      format: post.format,
      had_hero: !!article.hero_image_url,
    },
  });

  revalidatePath(`/admin/materias/${post.article_id}`);
  revalidatePath(`/admin/estudio/${post.article_id}`);
  revalidatePath("/admin/social");

  return { ok: true };
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
