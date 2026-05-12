import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import NewsCard from "@/components/news-card";
import NewsCardList from "@/components/news-card-list";
import Sidebar from "@/components/sidebar";
import Pagination from "@/components/pagination";
import {
  EDITORIA_DESCRIPTION,
  EDITORIA_LABEL,
  EDITORIA_SLUGS,
  type EditoriaSlug,
} from "@/lib/db/types";
import {
  getArticlesByEditoriaPaginated,
  getCidadesEmEditoria,
} from "@/lib/db/articles";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return EDITORIA_SLUGS.map((editoria) => ({ editoria }));
}

function isEditoria(s: string): s is EditoriaSlug {
  return (EDITORIA_SLUGS as readonly string[]).includes(s);
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { editoria: string };
  searchParams: { cidade?: string; p?: string };
}): Promise<Metadata> {
  if (!isEditoria(params.editoria)) return { title: "ZIMBANET" };
  const label = EDITORIA_LABEL[params.editoria];
  const cidade = searchParams.cidade?.trim();
  const page = parsePage(searchParams.p);
  const pageSuffix = page > 1 ? ` · Página ${page}` : "";
  const title = cidade
    ? `${label} · ${cidade}${pageSuffix} — ZIMBANET`
    : `${label}${pageSuffix} — ZIMBANET`;
  const noindex = !!cidade || page > 1;
  return {
    title,
    description: cidade
      ? `Notícias de ${cidade} na editoria ${label.toLowerCase()} do ZIMBANET.`
      : EDITORIA_DESCRIPTION[params.editoria],
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

export default async function EditoriaPage({
  params,
  searchParams,
}: {
  params: { editoria: string };
  searchParams: { cidade?: string; p?: string };
}) {
  if (!isEditoria(params.editoria)) notFound();
  const slug = params.editoria;
  const label = EDITORIA_LABEL[slug];
  const description = EDITORIA_DESCRIPTION[slug];
  const cidade = searchParams.cidade?.trim() || undefined;
  const page = parsePage(searchParams.p);

  const [paged, cidades] = await Promise.all([
    getArticlesByEditoriaPaginated(slug, { page, pageSize: 24, cidade }),
    getCidadesEmEditoria(slug),
  ]);
  const articles = paged.items;
  const isFirstPage = paged.page === 1;
  const [lead, ...rest] = articles;
  const featured = isFirstPage ? rest.slice(0, 3) : [];
  const list = isFirstPage ? rest.slice(3) : articles;

  const baseHref = cidade
    ? `/${slug}?cidade=${encodeURIComponent(cidade)}`
    : `/${slug}`;

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      <main className="zb-container pb-12">
        {/* Cabeçalho da editoria */}
        <header className="border-b border-border-subtle pb-6 pt-8 mb-8">
          <div className="flex items-baseline gap-3">
            <span className="h-[3px] w-10 bg-zimba-gold" aria-hidden />
            <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-zimba-gold">
              Editoria{cidade ? ` · ${cidade}` : ""}
            </p>
          </div>
          <h1 className="mt-3 font-display text-fs-44 lg:text-fs-56 font-black leading-tight tracking-tight2 text-navy">
            {label.charAt(0) + label.slice(1).toLowerCase()}
            {cidade && (
              <span className="text-fs-22 lg:text-fs-28 font-normal text-ink-500 ml-3">
                em {cidade}
              </span>
            )}
          </h1>
          <p className="mt-3 max-w-[60ch] text-fs-16 leading-relaxed text-ink-700">
            {description}
          </p>
          {paged.totalPages > 1 && (
            <p className="mt-3 text-fs-13 text-ink-500">
              {paged.total} {paged.total === 1 ? "matéria" : "matérias"} · página{" "}
              {paged.page} de {paged.totalPages}
            </p>
          )}

          {cidades.length > 1 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mr-1">
                Cidades:
              </span>
              <Link
                href={`/${slug}`}
                className={`text-fs-12 font-semibold rounded-xs px-3 py-1.5 transition-colors ${
                  !cidade
                    ? "bg-navy text-off-white"
                    : "bg-white border border-navy/15 text-navy/70 hover:border-zimba-gold"
                }`}
              >
                Todas
              </Link>
              {cidades.map((c) => (
                <Link
                  key={c}
                  href={`/${slug}?cidade=${encodeURIComponent(c)}`}
                  className={`text-fs-12 font-semibold rounded-xs px-3 py-1.5 transition-colors ${
                    cidade === c
                      ? "bg-zimba-gold text-navy"
                      : "bg-white border border-navy/15 text-navy/70 hover:border-zimba-gold"
                  }`}
                >
                  {c}
                </Link>
              ))}
            </div>
          )}
        </header>

        {articles.length === 0 ? (
          <EmptyState label={label} cidade={cidade} editoriaSlug={slug} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
            <div className="min-w-0">
              {isFirstPage ? (
                <>
                  {/* Lead — primeiro card maior (apenas página 1) */}
                  {lead && (
                    <article className="mb-10">
                      <NewsCard article={lead} seed={1} badge="destaque" />
                    </article>
                  )}

                  {/* Three-up de destaques */}
                  {featured.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                      {featured.map((a, i) => (
                        <NewsCard key={a.id} article={a} seed={i + 2} />
                      ))}
                    </div>
                  )}

                  {/* Resto em lista */}
                  {list.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {list.map((a, i) => (
                        <NewsCardList key={a.id} article={a} seed={i + 6} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Páginas 2+ — grid plano, sem lead/destaque */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {articles.map((a, i) => (
                    <NewsCardList key={a.id} article={a} seed={i + 4} />
                  ))}
                </div>
              )}

              <Pagination
                page={paged.page}
                totalPages={paged.totalPages}
                baseHref={baseHref}
              />
            </div>

            <Sidebar />
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function EmptyState({
  label,
  cidade,
  editoriaSlug,
}: {
  label: string;
  cidade?: string;
  editoriaSlug: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-white p-10 text-center">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-zimba-gold mb-3">
        {label}
        {cidade ? ` · ${cidade}` : ""}
      </p>
      <p className="font-display text-fs-24 text-navy mb-2">
        {cidade ? `Sem matéria de ${cidade} aqui (ainda).` : "Nada publicado por aqui ainda."}
      </p>
      <p className="font-sans text-fs-14 text-ink-500">
        {cidade
          ? "Volte em breve — ou tira o filtro pra ver tudo da editoria."
          : "Volte em breve — a redação está apurando."}
      </p>
      {cidade && (
        <Link
          href={`/${editoriaSlug}`}
          className="mt-5 inline-block text-[11px] uppercase tracking-[0.22em] font-bold text-zimba-gold hover:text-navy"
        >
          Ver toda a editoria →
        </Link>
      )}
    </div>
  );
}
