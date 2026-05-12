import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import NewsCard from "@/components/news-card";
import Sidebar from "@/components/sidebar";
import { getArticlesByTagPaginated, getTopTags } from "@/lib/db/articles";
import Pagination from "@/components/pagination";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zimbanet.com";

function decodeTag(slug: string): string {
  try {
    return decodeURIComponent(slug).trim();
  } catch {
    return slug;
  }
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const tag = decodeTag(params.slug);
  return {
    title: `#${tag} · ZIMBANET`,
    description: `Matérias marcadas com #${tag} no ZIMBANET — Imbituba conectada.`,
    alternates: { canonical: `${SITE}/tag/${encodeURIComponent(tag)}` },
    openGraph: {
      title: `#${tag} · ZIMBANET`,
      description: `Matérias marcadas com #${tag}.`,
      url: `${SITE}/tag/${encodeURIComponent(tag)}`,
      siteName: "ZIMBANET",
      type: "website",
      locale: "pt_BR",
      images: [
        {
          url: `${SITE}/api/og?title=${encodeURIComponent(`#${tag}`)}&editoria=Tag`,
          width: 1200,
          height: 630,
          alt: `#${tag}`,
        },
      ],
    },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { p?: string };
}) {
  const tag = decodeTag(params.slug);
  if (!tag) notFound();
  const page = parsePage(searchParams.p);

  const [paged, related] = await Promise.all([
    getArticlesByTagPaginated(tag, { page, pageSize: 24 }),
    getTopTags(20),
  ]);
  const articles = paged.items;
  const baseHref = `/tag/${encodeURIComponent(tag)}`;

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      <main className="zb-container pb-16">
        <nav
          aria-label="Caminho"
          className="pt-6 pb-3 font-sans text-fs-12 uppercase tracking-[0.16em] text-ink-500"
        >
          <Link href="/" className="hover:text-navy">Início</Link>
          <span className="px-2 text-ink-300">/</span>
          <span className="text-navy">tag</span>
        </nav>

        <header className="pb-6 mb-8 border-b border-border-subtle">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
            Tag
          </p>
          <h1 className="font-display font-black leading-[1.05] tracking-[-0.02em] text-navy text-fs-36 lg:text-fs-44">
            #{tag}
          </h1>
          <p className="mt-3 text-fs-14 text-ink-500">
            {paged.total === 0
              ? "Nada marcado com essa tag (ainda)."
              : `${paged.total} ${paged.total === 1 ? "matéria" : "matérias"} marcada${paged.total === 1 ? "" : "s"}${paged.totalPages > 1 ? ` · página ${paged.page} de ${paged.totalPages}` : ""}.`}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-12">
          <section className="min-w-0">
            {articles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {articles.map((a, i) => (
                    <NewsCard key={a.id} article={a} seed={i + 5} />
                  ))}
                </div>
                <Pagination
                  page={paged.page}
                  totalPages={paged.totalPages}
                  baseHref={baseHref}
                />
              </>
            ) : (
              <div className="rounded-md border border-border-subtle bg-white p-8 text-fs-14 text-ink-500">
                Nenhuma matéria publicada usa essa tag por enquanto.
                <Link
                  href="/"
                  className="block mt-4 text-[11px] uppercase tracking-[0.22em] font-bold text-zimba-gold hover:text-navy"
                >
                  ← Voltar pra capa
                </Link>
              </div>
            )}

            {related.length > 0 && (
              <section className="mt-14 pt-10 border-t border-border-subtle">
                <h2 className="font-display font-bold text-fs-22 text-navy mb-4 flex items-baseline gap-3">
                  <span className="h-[3px] w-8 bg-zimba-gold" aria-hidden />
                  Tags em alta
                </h2>
                <div className="flex flex-wrap gap-2">
                  {related
                    .filter((t) => t.tag !== tag)
                    .slice(0, 18)
                    .map(({ tag: t, count }) => (
                      <Link
                        key={t}
                        href={`/tag/${encodeURIComponent(t)}`}
                        className="inline-flex items-baseline gap-1.5 rounded-xs bg-navy/5 px-3 py-1.5 font-sans text-fs-12 font-medium text-navy/70 hover:bg-zimba-gold hover:text-navy transition-colors"
                      >
                        <span>#{t}</span>
                        <span className="text-fs-10 tabular-nums opacity-60">{count}</span>
                      </Link>
                    ))}
                </div>
              </section>
            )}
          </section>

          <aside className="min-w-0">
            <Sidebar />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
