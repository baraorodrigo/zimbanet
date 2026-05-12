import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";
import { approveArticle, rejectArticle } from "@/lib/actions/articles";
import { getArticleSourceUrls } from "@/lib/db/articles";
import { Header } from "../_components/header";

export const dynamic = "force-dynamic";

export default async function FilaPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, editoria, kicker, lede, body, byline, hero_image_url, status, is_breaking, is_exclusive, created_at, updated_at")
    .in("status", ["draft", "review"])
    .order("updated_at", { ascending: false })
    .limit(50);

  const items = data ?? [];
  const sourceMap = await getArticleSourceUrls(items.map((a) => a.id as string));
  const withHero = items.filter((a) => !!(a.hero_image_url as string | null)).length;
  const withoutHero = items.length - withHero;

  return (
    <>
      <Header
        kicker="Fila · passo 2 de 2"
        title="Aguardando publicação"
        sub={
          items.length === 0
            ? "Fila vazia. Quando você redigir uma matéria a partir da Pauta (ou criar do zero), ela aparece aqui pra revisar e publicar."
            : `${items.length} matéria${items.length === 1 ? "" : "s"} pra revisar — vindas da Pauta ou criadas à mão. ${withHero} com foto · ${withoutHero} sem foto.`
        }
      />

      {error && (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          Erro carregando fila: {error.message}
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-10 rounded-md border-2 border-dashed border-border-subtle bg-white p-10 text-center">
          <p className="font-display font-black text-fs-20 text-navy">Fila vazia</p>
          <p className="mt-2 text-fs-14 text-ink-500 max-w-[44ch] mx-auto">
            Quando você criar uma matéria como rascunho, ela aparece aqui pra revisão antes de publicar.
          </p>
          <Link
            href="/admin/materias/nova"
            className="inline-block mt-5 h-11 px-5 leading-[44px] rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
          >
            Criar matéria
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((a) => {
            const heroUrl = a.hero_image_url as string | null;
            const hasHero = !!heroUrl;
            return (
            <li
              key={a.id as string}
              className={`rounded-md border bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[160px_1fr] md:grid-cols-[160px_1fr_auto] gap-4 sm:gap-5 ${
                hasHero ? "border-border-subtle" : "border-alert-red/30"
              }`}
            >
              {/* Hero thumb — sinal visual #1 do "tem foto / não tem foto" */}
              <Link
                href={`/admin/materias/${a.id}`}
                className="block relative aspect-[16/9] sm:aspect-square rounded-md overflow-hidden border border-border-subtle bg-navy"
                aria-label={
                  hasHero ? `Editar matéria "${a.title}"` : `Matéria "${a.title}" sem foto — clique pra adicionar`
                }
              >
                {hasHero ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroUrl as string}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2 bg-gradient-to-br from-alert-red/15 via-navy to-navy">
                    <span className="text-alert-red text-fs-18 leading-none">⚠</span>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.22em] font-bold text-alert-red">
                      sem foto
                    </p>
                    <p className="mt-1 text-[10px] text-off-white/70 leading-tight">
                      clica pra adicionar
                    </p>
                  </div>
                )}
                {hasHero && (
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 bg-eco-green text-white text-[9px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded-xs">
                    ✓ com foto
                  </span>
                )}
              </Link>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
                    {EDITORIA_LABEL[a.editoria as EditoriaSlug] ?? a.editoria}
                  </span>
                  {a.is_breaking && (
                    <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-alert-red">
                      breaking
                    </span>
                  )}
                  {a.is_exclusive && (
                    <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-blue">
                      exclusivo
                    </span>
                  )}
                  <span className="text-fs-12 text-ink-400">
                    {a.status === "review" ? "em revisão" : "rascunho"} ·{" "}
                    {new Date(a.updated_at as string).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {a.kicker && (
                  <p className="font-sans text-[11px] uppercase tracking-[0.18em] font-bold text-zimba-blue mt-2">
                    {a.kicker}
                  </p>
                )}
                <h3 className="font-display font-black text-fs-24 leading-[1.15] text-navy mt-1">
                  <Link href={`/admin/materias/${a.id}`} className="hover:text-zimba-blue">
                    {a.title}
                  </Link>
                </h3>
                {a.lede && (
                  <p className="mt-2 text-fs-14 text-ink-700 leading-relaxed line-clamp-2">
                    {a.lede}
                  </p>
                )}
                {a.byline && (
                  <p className="mt-2 text-fs-12 text-ink-500">por {a.byline}</p>
                )}
                {(() => {
                  const src = sourceMap.get(a.id as string);
                  if (!src) return null;
                  return (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-blue hover:text-navy"
                      title={src.url}
                    >
                      📰 Fonte original
                      {src.host && (
                        <span className="font-mono normal-case tracking-normal text-ink-500">
                          {src.host}
                        </span>
                      )}
                      <span aria-hidden>↗</span>
                    </a>
                  );
                })()}
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:w-[180px] shrink-0">
                {hasHero ? (
                  <form action={approveArticle} className="contents">
                    <input type="hidden" name="id" value={a.id as string} />
                    <button
                      type="submit"
                      className="flex-1 h-10 rounded-md bg-eco-green text-white text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-green-700 transition-colors"
                      title="Tem foto — pode publicar direto"
                    >
                      ✓ Publicar
                    </button>
                  </form>
                ) : (
                  <Link
                    href={`/admin/materias/${a.id}`}
                    className="flex-1 h-10 rounded-md bg-alert-red text-white text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-alert-red/90 transition-colors inline-flex items-center justify-center"
                    title="Sem foto — abre a edição pra você adicionar antes de publicar"
                  >
                    ⚠ Adicionar foto
                  </Link>
                )}
                <Link
                  href={`/admin/materias/${a.id}`}
                  className="flex-1 h-10 rounded-md border border-navy/20 text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:border-navy inline-flex items-center justify-center"
                >
                  Editar
                </Link>
                <form action={rejectArticle} className="contents">
                  <input type="hidden" name="id" value={a.id as string} />
                  <button
                    type="submit"
                    className="flex-1 h-10 rounded-md border border-alert-red/30 text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-alert-red hover:text-white transition-colors"
                  >
                    Rejeitar
                  </button>
                </form>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
