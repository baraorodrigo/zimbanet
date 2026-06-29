"use server";

// Social kit: renderiza os templates oficiais (card/story/banner) via Puppeteer
// no /api/social/render. NÃO gera imagem com IA — usa o hero + textos da matéria.

import { revalidatePath } from "next/cache";
import { requireStaff, type TemplateResult } from "./shared";

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
