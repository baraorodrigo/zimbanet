import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import NewsCard from "@/components/news-card";
import Sidebar from "@/components/sidebar";
import Icon from "@/components/icon";
import ArticleComments from "@/components/article-comments";
import ShareButtons from "@/components/share-buttons";
import ReadingProgress from "@/components/reading-progress";
import {
  EDITORIA_LABEL,
  EDITORIA_SLUGS,
  type EditoriaSlug,
} from "@/lib/db/types";
import { getArticleViewBySlug, getArticlesByEditoria } from "@/lib/db/articles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zimbanet.com";

type ArticleCommentRow = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
};

async function loadArticleComments(articleId: string): Promise<ArticleCommentRow[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("article_comments")
      .select("id, author_name, body, created_at")
      .eq("article_id", articleId)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: true });
    return (data ?? []) as ArticleCommentRow[];
  } catch {
    return [];
  }
}

function isEditoria(s: string): s is EditoriaSlug {
  return (EDITORIA_SLUGS as readonly string[]).includes(s);
}

export async function generateMetadata({
  params,
}: {
  params: { editoria: string; slug: string };
}): Promise<Metadata> {
  if (!isEditoria(params.editoria)) return { title: "ZIMBANET" };
  const { row, view } = await getArticleViewBySlug(params.slug);
  const title = view?.title ?? "Matéria — ZIMBANET";
  const description = row?.lede ?? row?.subtitle ?? view?.lede ?? undefined;
  const heroImage = row?.hero_image_url ?? view?.image ?? null;
  const editoriaLabel = EDITORIA_LABEL[params.editoria as EditoriaSlug] ?? "ZIMBANET";
  const ogParams = new URLSearchParams({
    title: view?.title ?? title,
    editoria: editoriaLabel,
  });
  if (row?.is_breaking) ogParams.set("breaking", "1");
  if (row?.is_exclusive) ogParams.set("kicker", "Exclusivo");
  const ogImage = `${SITE}/api/og?${ogParams.toString()}`;
  const images = [
    ...(heroImage ? [{ url: heroImage, width: 1200, height: 630, alt: view?.title ?? title }] : []),
    { url: ogImage, width: 1200, height: 630, alt: view?.title ?? title },
  ];
  const canonical = `${SITE}/${params.editoria}/${params.slug}`;
  return {
    metadataBase: new URL(SITE),
    title: `${title} — ZIMBANET`,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "ZIMBANET",
      type: "article",
      locale: "pt_BR",
      images,
      publishedTime: row?.published_at ?? undefined,
      modifiedTime: row?.updated_at ?? row?.published_at ?? undefined,
      section: editoriaLabel,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [heroImage ?? ogImage],
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: { editoria: string; slug: string };
}) {
  if (!isEditoria(params.editoria)) notFound();
  const editoria = params.editoria;
  const label = EDITORIA_LABEL[editoria];

  const { row, view } = await getArticleViewBySlug(params.slug);
  if (!view) notFound();

  const heroImage = row?.hero_image_url ?? view.image;
  const heroAlt = row?.hero_image_alt ?? view.imageAlt ?? view.title;
  const credit = row?.hero_image_credit;
  const lede = row?.lede ?? view.lede;
  const subtitle = row?.subtitle;
  const body = row?.body ?? "";
  const byline = row?.byline ?? view.author ?? "Redação Zimbanet";
  const readingMinutes = row?.reading_minutes ?? estimateReadingMinutes(body);
  const isBreaking = !!row?.is_breaking;
  const isExclusive = !!row?.is_exclusive;
  const tags = row?.tags ?? [];
  const cities = row?.cities ?? [];

  const related = (
    await getArticlesByEditoria(editoria, { limit: 5, excludeId: row?.id })
  )
    .filter((a) => a.slug !== params.slug)
    .slice(0, 4);

  const supabase = createClient();
  const [userResult, comments] = await Promise.all([
    supabase.auth.getUser(),
    row?.id ? loadArticleComments(row.id) : Promise.resolve([] as ArticleCommentRow[]),
  ]);
  const isLoggedIn = !!userResult.data.user;

  const articleUrl = `${SITE}/${editoria}/${view.slug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE },
      { "@type": "ListItem", position: 2, name: label, item: `${SITE}/${editoria}` },
      { "@type": "ListItem", position: 3, name: view.title, item: articleUrl },
    ],
  };

  const ldJson = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: view.title,
    description: lede ?? subtitle ?? undefined,
    image: heroImage ? [heroImage] : undefined,
    datePublished: row?.published_at ?? row?.created_at,
    dateModified: row?.updated_at ?? row?.published_at ?? row?.created_at,
    author: byline
      ? [{ "@type": "Person", name: byline }]
      : [{ "@type": "Organization", name: "ZIMBANET" }],
    publisher: {
      "@type": "Organization",
      name: "ZIMBANET",
      logo: {
        "@type": "ImageObject",
        url: `${SITE}/logos/zimbanet-mark.svg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    articleSection: label,
    keywords: tags?.join(", "),
    isAccessibleForFree: true,
  };

  return (
    <div className="min-h-screen bg-off-white">
      <ReadingProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <SiteHeader />

      <main className="zb-container pb-16">
        {/* Breadcrumb */}
        <nav
          aria-label="Caminho"
          className="pt-6 pb-3 font-sans text-fs-12 uppercase tracking-[0.16em] text-ink-500"
        >
          <Link href="/" className="hover:text-navy">
            Início
          </Link>
          <span className="px-2 text-ink-300">/</span>
          <Link
            href={`/${editoria}`}
            className="hover:text-navy"
          >
            {label}
          </Link>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-12">
          <article className="min-w-0">
            {/* Header */}
            <header className="mb-8 border-b border-border-subtle pb-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="font-sans text-fs-12 font-bold uppercase tracking-[0.22em] text-zimba-gold">
                  {label}
                </span>
                {isBreaking && (
                  <span className="rounded-xs bg-alert-red px-2 py-[3px] font-sans text-fs-11 font-bold uppercase tracking-[0.18em] text-white">
                    Breaking
                  </span>
                )}
                {isExclusive && (
                  <span className="rounded-xs bg-zimba-gold px-2 py-[3px] font-sans text-fs-11 font-bold uppercase tracking-[0.18em] text-navy">
                    ★ Exclusivo
                  </span>
                )}
              </div>

              <h1 className="font-display text-fs-44 lg:text-fs-56 font-black leading-tight tracking-tight2 text-navy text-balance">
                {view.title}
              </h1>

              {(subtitle || lede) && (
                <p className="mt-5 max-w-[62ch] font-display text-fs-20 lg:text-fs-22 leading-snug text-ink-700 text-pretty">
                  {subtitle ?? lede}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-fs-13 text-ink-500">
                <span className="inline-flex items-center gap-1.5 text-navy">
                  <Icon name="user" size={14} />
                  <span className="font-medium">Por {byline}</span>
                </span>
                <span className="text-ink-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" size={14} />
                  {view.publishedAt}
                </span>
                {readingMinutes ? (
                  <>
                    <span className="text-ink-300">·</span>
                    <span>{readingMinutes} min de leitura</span>
                  </>
                ) : null}
              </div>
            </header>

            {/* Hero image */}
            {heroImage && (
              <figure className="mb-8">
                <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-ink-100">
                  <Image
                    src={heroImage}
                    alt={heroAlt}
                    fill
                    sizes="(min-width: 1024px) 740px, 100vw"
                    className="object-cover"
                    priority
                  />
                </div>
                {credit && (
                  <figcaption className="mt-2 font-sans text-fs-12 text-ink-500">
                    {credit}
                  </figcaption>
                )}
              </figure>
            )}

            {/* Body — teto de 68ch pra leitura confortável; em mobile a coluna
                já é estreita então o max-w não interfere */}
            {body ? (
              <div className="prose-zb max-w-[68ch] font-display text-fs-19 leading-[1.7] text-navy">
                {body.split(/\n\n+/).map((para, i) => (
                  <p key={i} className="mb-5">
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-border-subtle bg-white p-6 font-sans text-fs-14 text-ink-700">
                Esta matéria ainda não tem corpo publicado. O texto integral é
                gerado pelo Content Engine quando o pipeline está completo —
                em modo demo só o cabeçalho aparece.
              </p>
            )}

            {/* Share */}
            <ShareButtons title={view.title} url={articleUrl} />

            {/* Tags + cities */}
            {(tags.length > 0 || cities.length > 0) && (
              <div className="mt-10 border-t border-border-subtle pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  {cities.map((c) => (
                    <Link
                      key={`city-${c}`}
                      href={`/cidade?cidade=${encodeURIComponent(c)}`}
                      className="rounded-xs border border-border-subtle bg-white px-2.5 py-1 font-sans text-fs-12 font-medium text-navy hover:border-zimba-gold"
                    >
                      📍 {c}
                    </Link>
                  ))}
                  {tags.map((t) => (
                    <Link
                      key={`tag-${t}`}
                      href={`/tag/${encodeURIComponent(t)}`}
                      className="rounded-xs bg-navy/5 px-2.5 py-1 font-sans text-fs-12 font-medium text-navy/70 hover:bg-zimba-gold hover:text-navy transition-colors"
                    >
                      #{t}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {row?.id && (
              <ArticleComments
                articleId={row.id}
                articleSlug={`${editoria}/${view.slug}`}
                isLoggedIn={isLoggedIn}
                initialComments={comments}
              />
            )}
          </article>

          <aside className="min-w-0">
            <Sidebar />
          </aside>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16 border-t border-border-subtle pt-10">
            <div className="mb-6 flex items-baseline gap-3">
              <span className="h-[3px] w-10 bg-zimba-gold" aria-hidden />
              <h2 className="font-display text-fs-24 font-bold text-navy">
                Mais de {label.charAt(0) + label.slice(1).toLowerCase()}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((a, i) => (
                <NewsCard key={a.id} article={a} seed={i + 12} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function estimateReadingMinutes(body: string): number {
  if (!body) return 0;
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
