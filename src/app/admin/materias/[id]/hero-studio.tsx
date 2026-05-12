// Estúdio de Imagens da matéria — card que aparece no topo da edição,
// no fluxo "Redigir com IA". Cobre 3 caminhos pro hero:
//   1. Buscar da fonte original (raw_items.image_url já scrapeado)
//   2. Trocar via URL (admin cola um link)
//   3. Abrir Estúdio completo (/admin/estudio/[id]) — geração IA + social
//
// Tudo via Server Action — sem JS client. O preview revalida sozinho.

import Link from "next/link";
import {
  refreshArticleHeroFromSource,
  setArticleHeroFromUrl,
} from "@/lib/actions/media-studio";
import { HeroAIGenerator } from "./hero-ai-generator";
import { HeroUpload } from "./hero-upload";
import { ApplyHeroToCards } from "./apply-hero-to-cards";

type Props = {
  articleId: string;
  articleTitle: string;
  articleLede: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  hasScoredOrigin: boolean;
};

export function HeroStudio({
  articleId,
  articleTitle,
  articleLede,
  heroImageUrl,
  heroImageAlt,
  hasScoredOrigin,
}: Props) {
  const empty = !heroImageUrl;
  return (
    <section
      aria-labelledby="hero-studio-title"
      className="rounded-md border-2 border-zimba-gold/40 bg-white overflow-hidden"
    >
      <header className="px-5 py-3 bg-zimba-gold/10 border-b border-zimba-gold/30 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
            Redigir com IA · imagem
          </p>
          <h2
            id="hero-studio-title"
            className="font-display font-black text-fs-20 text-navy leading-tight mt-0.5"
          >
            🎨 Estúdio de Imagens
          </h2>
        </div>
        <Link
          href={`/admin/estudio/${articleId}`}
          className="text-fs-12 text-ink-500 hover:text-navy underline-offset-2 hover:underline"
          title="Ajuste fino por canvas (IG feed, stories, FB, etc)"
        >
          ajuste fino dos canvases sociais →
        </Link>
      </header>

      <div className="grid md:grid-cols-[320px_1fr]">
        {/* Preview do hero atual */}
        <div className="aspect-[16/9] md:aspect-auto md:min-h-[240px] bg-off-white relative border-b md:border-b-0 md:border-r border-border-subtle">
          {heroImageUrl ? (
            // next/image exigiria remotePatterns por host; usar <img> aqui é OK
            // — admin only, sem SEO, sem priority de LCP. Mantém simples.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageUrl}
              alt={heroImageAlt ?? "Hero da matéria"}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div>
                <p className="font-display font-black text-fs-16 text-ink-500">
                  Sem imagem ainda
                </p>
                <p className="text-fs-12 text-ink-400 mt-1 max-w-[28ch] mx-auto">
                  Busque da fonte, cole uma URL ou gere no Estúdio.
                </p>
              </div>
            </div>
          )}
          {heroImageAlt && (
            <p className="absolute bottom-0 inset-x-0 bg-navy/85 text-off-white text-fs-11 px-3 py-1.5 leading-snug line-clamp-2">
              Alt: {heroImageAlt}
            </p>
          )}
        </div>

        {/* Ações */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500">
              Buscar da fonte original
            </h3>
            <p className="text-fs-12 text-ink-700 mt-1 max-w-[60ch]">
              Re-baixa a imagem que o radar extraiu do feed/og:image da matéria
              original e a hospeda no nosso CDN.
            </p>
            <form action={refreshArticleHeroFromSource} className="mt-2">
              <input type="hidden" name="article_id" value={articleId} />
              <button
                type="submit"
                disabled={!hasScoredOrigin}
                className="h-10 px-4 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={
                  hasScoredOrigin
                    ? "Lê raw_items.image_url e re-hospeda"
                    : "Matéria criada manual — não tem origem rastreável"
                }
              >
                {empty ? "↓ Trazer foto da fonte" : "↻ Re-baixar da fonte"}
              </button>
            </form>
          </div>

          <div className="border-t border-border-subtle pt-4">
            <h3 className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500">
              Ou cole uma URL nova
            </h3>
            <form
              action={setArticleHeroFromUrl}
              className="mt-2 flex flex-wrap gap-2"
            >
              <input type="hidden" name="article_id" value={articleId} />
              <input
                type="url"
                name="url"
                placeholder="https://..."
                required
                className="flex-1 min-w-[200px] h-10 px-3 rounded-md border-2 border-border-subtle font-mono text-fs-12 focus:outline-none focus:border-navy bg-off-white"
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-md border-2 border-navy text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors"
              >
                Salvar URL
              </button>
            </form>
            <p className="text-fs-11 text-ink-400 mt-1.5">
              A gente baixa, re-hospeda no bucket e troca o hero — admin não
              precisa preencher manualmente abaixo.
            </p>
          </div>

          <HeroUpload articleId={articleId} hasHero={!!heroImageUrl} />

          <ApplyHeroToCards articleId={articleId} hasHero={!!heroImageUrl} />

          <HeroAIGenerator
            articleId={articleId}
            articleTitle={articleTitle}
            articleLede={articleLede}
            hasHero={!!heroImageUrl}
          />
        </div>
      </div>
    </section>
  );
}
