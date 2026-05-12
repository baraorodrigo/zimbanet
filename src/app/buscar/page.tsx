import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import NewsCard from "@/components/news-card";
import Sidebar from "@/components/sidebar";
import { searchArticlesPaginated } from "@/lib/db/articles";
import Pagination from "@/components/pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<Metadata> {
  const q = (searchParams.q ?? "").trim();
  return {
    title: q ? `Busca: ${q} · ZIMBANET` : "Busca · ZIMBANET",
    description: q
      ? `Resultados pra "${q}" no ZIMBANET — Imbituba conectada.`
      : "Busca de matérias no ZIMBANET — Imbituba conectada.",
    robots: { index: false, follow: true },
  };
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; p?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const page = parsePage(searchParams.p);
  const paged =
    q.length >= 2
      ? await searchArticlesPaginated(q, { page, pageSize: 24 })
      : { items: [], total: 0, page: 1, pageSize: 24, totalPages: 1 };
  const results = paged.items;
  const baseHref = `/buscar?q=${encodeURIComponent(q)}`;

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      <main className="zb-container pb-16">
        <header className="pt-8 pb-6 border-b border-border-subtle mb-8">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
            Busca
          </p>
          <h1 className="font-display font-black leading-[1.05] tracking-[-0.02em] text-navy text-fs-36 lg:text-fs-44">
            {q ? <>Resultados pra <span className="text-zimba-gold">&ldquo;{q}&rdquo;</span></> : "Buscar matérias"}
          </h1>
          <form
            action="/buscar"
            method="get"
            role="search"
            className="mt-6 flex items-center gap-2 max-w-xl border border-navy/15 bg-white rounded-sm px-4 h-12 focus-within:border-zimba-gold transition-colors"
          >
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Buscar em Imbituba…"
              aria-label="Termo de busca"
              autoFocus={!q}
              className="flex-1 bg-transparent outline-none text-fs-15 text-navy placeholder:text-ink-400"
            />
            <button
              type="submit"
              className="bg-navy text-off-white text-[11px] uppercase tracking-[0.22em] font-bold px-5 h-9 hover:bg-zimba-gold hover:text-navy transition-colors"
            >
              Buscar
            </button>
          </form>
          {q && (
            <p className="mt-4 text-fs-13 text-ink-500">
              {paged.total === 0
                ? "Nada encontrado. Tente outro termo."
                : `${paged.total} ${paged.total === 1 ? "resultado" : "resultados"}${paged.totalPages > 1 ? ` · página ${paged.page} de ${paged.totalPages}` : ""}.`}
            </p>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-12">
          <section className="min-w-0">
            {results.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {results.map((a, i) => (
                    <NewsCard key={a.id} article={a} seed={i + 7} />
                  ))}
                </div>
                <Pagination
                  page={paged.page}
                  totalPages={paged.totalPages}
                  baseHref={baseHref}
                />
              </>
            ) : q.length >= 2 ? (
              <div className="rounded-md border border-border-subtle bg-white p-8">
                <p className="font-display text-fs-19 text-navy mb-3">
                  Nada por aqui (ainda).
                </p>
                <p className="text-fs-14 text-ink-500 leading-relaxed mb-4">
                  Tenta variar a grafia, usar um sinônimo, ou procurar por um
                  bairro / time / nome próprio. Se for assunto novo, pode ser
                  que ainda não cobrimos.
                </p>
                <Link
                  href="/"
                  className="inline-block text-[11px] uppercase tracking-[0.22em] font-bold text-zimba-gold hover:text-navy"
                >
                  ← Voltar pra capa
                </Link>
              </div>
            ) : (
              <div className="rounded-md border border-border-subtle bg-white p-8 text-fs-14 text-ink-500 leading-relaxed">
                Digite ao menos 2 caracteres pra buscar matérias publicadas.
              </div>
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
