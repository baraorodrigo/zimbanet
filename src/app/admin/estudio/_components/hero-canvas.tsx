// Canvas central do pseudo-canal "__hero__" (Capa do portal).
// Espelha o layout do CanvasStage: preview grande no topo, ações abaixo.
// NÃO renderiza header próprio — a página já mostra o sub-header
// "Canvas ativo · Capa do portal" acima dele.
//
// O hero é a foto-mestra da matéria — é cropada em múltiplos aspects no
// portal (16:10 na home, 1:1 nos cards, 16:9 na página da matéria).
// Mostramos no preview com aspect-[16/10] por ser o crop mais visível
// (hero da home).

import {
  refreshArticleHeroFromSource,
  setArticleHeroFromUrl,
} from "@/lib/actions/media-studio";
import { HeroUpload } from "@/app/admin/materias/[id]/hero-upload";
import { ApplyHeroToCards } from "@/app/admin/materias/[id]/apply-hero-to-cards";
import { HeroAIGenerator } from "@/app/admin/materias/[id]/hero-ai-generator";
import { HeroReframer } from "./hero-reframer";

type Props = {
  articleId: string;
  articleTitle: string;
  articleLede: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  hasScoredOrigin: boolean;
};

export function HeroCanvas({
  articleId,
  articleTitle,
  articleLede,
  heroImageUrl,
  heroImageAlt,
  hasScoredOrigin,
}: Props) {
  const empty = !heroImageUrl;

  return (
    <div className="space-y-6">
      {/* Preview principal — reframer interativo quando tem foto */}
      {heroImageUrl ? (
        <HeroReframer
          key={heroImageUrl}
          articleId={articleId}
          heroImageUrl={heroImageUrl}
          heroImageAlt={heroImageAlt}
        />
      ) : (
        <div className="mx-auto max-w-[720px]">
          <div className="relative aspect-[16/10] rounded-lg overflow-hidden border-2 border-dashed border-alert-red/30 bg-off-white">
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-gradient-to-br from-alert-red/10 via-off-white to-off-white">
              <div>
                <p className="text-alert-red text-fs-28 leading-none">⚠</p>
                <p className="mt-3 font-display font-black text-fs-20 text-navy">
                  Sem capa ainda
                </p>
                <p className="text-fs-13 text-ink-500 mt-1.5 max-w-[34ch] mx-auto">
                  Use uma das opções abaixo. Sem capa, a matéria sai sem foto
                  na home e nos cards.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ações — duas colunas em telas largas, empilhadas em mobile */}
      <div className="mx-auto max-w-[720px] grid md:grid-cols-2 gap-5">
        {/* Coluna 1: trazer foto */}
        <div className="rounded-md border border-border-subtle bg-white p-4">
          <h3 className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500">
            Buscar da fonte original
          </h3>
          <p className="text-fs-12 text-ink-700 mt-1">
            Re-baixa a imagem que o radar extraiu do feed/og:image da matéria
            original e hospeda no nosso bucket.
          </p>
          <form action={refreshArticleHeroFromSource} className="mt-3">
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

        {/* Coluna 2: URL */}
        <div className="rounded-md border border-border-subtle bg-white p-4">
          <h3 className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500">
            Cole uma URL
          </h3>
          <p className="text-fs-12 text-ink-700 mt-1">
            A gente baixa, re-hospeda no bucket e troca a capa.
          </p>
          <form
            action={setArticleHeroFromUrl}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input type="hidden" name="article_id" value={articleId} />
            <input
              type="url"
              name="url"
              placeholder="https://..."
              required
              className="flex-1 min-w-[160px] h-10 px-3 rounded-md border-2 border-border-subtle font-mono text-fs-12 focus:outline-none focus:border-navy bg-off-white"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-md border-2 border-navy text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors"
            >
              Salvar
            </button>
          </form>
        </div>

        {/* Coluna full-width: upload */}
        <div className="md:col-span-2 rounded-md border border-border-subtle bg-white p-4">
          <HeroUpload articleId={articleId} hasHero={!!heroImageUrl} />
        </div>

        {/* Aplicar nos cards (só se tem hero) */}
        {heroImageUrl && (
          <div className="md:col-span-2 rounded-md border-2 border-zimba-blue/30 bg-zimba-blue/5 p-4">
            <ApplyHeroToCards articleId={articleId} hasHero />
          </div>
        )}

        {/* Geração IA — só quando não tem origem rastreável OU admin quer trocar mesmo */}
        <div className="md:col-span-2 rounded-md border border-border-subtle bg-white p-4">
          <HeroAIGenerator
            articleId={articleId}
            articleTitle={articleTitle}
            articleLede={articleLede}
            hasHero={!!heroImageUrl}
          />
        </div>
      </div>
    </div>
  );
}
