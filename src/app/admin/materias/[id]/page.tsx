import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  publishArticle,
  unpublishArticle,
  setArticleAsCover,
  toggleArticleHighlight,
} from "@/lib/actions/articles";
import { getArticleSourceUrl } from "@/lib/db/articles";
import { listActivePersonas } from "@/lib/db/personas";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";
import { Header } from "../../_components/header";
import ArticleForm from "../nova/form";
import DeleteForm from "./delete-form";
import { HeroStudio } from "./hero-studio";
import { PersonaRewriter } from "./persona-rewriter";
import { SocialDistribution } from "./social-panel";
import { ArticlePreview } from "./article-preview";
import type { ArticleRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "rascunho",
  review: "em revisão",
  scheduled: "agendado",
  published: "publicado",
  rejected: "rejeitado",
  archived: "arquivado",
};

export default async function EditMateriaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) notFound();

  const source = await getArticleSourceUrl(params.id);
  const sourceUrl = source?.url ?? null;
  const sourceHost = source?.host ?? null;

  const personas = await listActivePersonas();
  const personasLite = personas.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    headline: p.headline,
    description: p.description,
  }));

  const isPublished = data.status === "published";

  return (
    <>
      <Header
        kicker={`${EDITORIA_LABEL[data.editoria as EditoriaSlug] ?? data.editoria} · ${
          STATUS_LABEL[data.status as string] ?? data.status
        }`}
        title={data.title as string}
        sub={`Editando matéria · criada em ${new Date(data.created_at as string).toLocaleString("pt-BR")}`}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {!isPublished && (
          <form action={publishArticle}>
            <input type="hidden" name="id" value={params.id} />
            <button
              type="submit"
              className="h-10 px-5 rounded-md bg-eco-green text-white text-[12px] uppercase tracking-[0.22em] font-bold inline-flex items-center hover:opacity-90 transition-opacity"
              title="Publica agora · sai do rascunho · dispara push se for breaking"
            >
              ✓ Publicar agora
            </button>
          </form>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="h-9 px-3 rounded-md border border-zimba-gold bg-zimba-gold/10 text-navy text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center gap-1.5 hover:bg-zimba-gold transition-colors"
            title={sourceUrl}
          >
            📰 Fonte original
            {sourceHost && (
              <span className="font-mono normal-case tracking-normal text-fs-11 text-ink-700">
                {sourceHost}
              </span>
            )}
            <span aria-hidden>↗</span>
          </a>
        )}
        {isPublished && (
          <Link
            href={`/${data.editoria}/${data.slug}`}
            target="_blank"
            className="h-9 px-4 rounded-md border border-eco-green text-eco-green text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center hover:bg-eco-green hover:text-white transition-colors"
          >
            ↗ Ver no portal
          </Link>
        )}
        {isPublished && (
          <form action={unpublishArticle}>
            <input type="hidden" name="id" value={params.id} />
            <button
              type="submit"
              className="h-9 px-4 rounded-md border border-zimba-blue text-zimba-blue text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-blue hover:text-white transition-colors"
            >
              Despublicar (volta pra rascunho)
            </button>
          </form>
        )}
        <Link
          href="/admin/materias"
          className="h-9 px-4 rounded-md border border-border-subtle text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center hover:border-navy hover:text-navy transition-colors"
        >
          ← Voltar
        </Link>
        <div className="ml-auto">
          <DeleteForm id={params.id} title={data.title as string} />
        </div>
      </div>

      {isPublished && (
        <div className="mt-6 rounded-md border border-zimba-gold/40 bg-zimba-gold/5 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-blue">
                curadoria da home
              </p>
              <p className="mt-1 font-display font-bold text-fs-15 text-navy">
                Onde essa matéria aparece na capa do portal?
              </p>
              <p className="mt-1 text-fs-12 text-ink-500 max-w-[60ch]">
                Capa é única — marca uma e tira automaticamente das outras. Destaques são livres
                (sugerido: até 3). Sem nada marcado, o portal cai no automático (mais recentes).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={setArticleAsCover}>
                <input type="hidden" name="id" value={params.id} />
                <button
                  type="submit"
                  className={`h-10 px-4 rounded-md text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center gap-2 transition-colors ${
                    data.is_cover
                      ? "bg-zimba-gold text-navy hover:bg-zimba-gold/90"
                      : "border border-zimba-gold text-navy hover:bg-zimba-gold/15"
                  }`}
                  title={
                    data.is_cover
                      ? "Já é capa — clique pra tirar"
                      : "Marca essa como capa e tira as outras"
                  }
                >
                  <span aria-hidden>{data.is_cover ? "★" : "☆"}</span>
                  {data.is_cover ? "É a capa" : "Marcar como capa"}
                </button>
              </form>
              <form action={toggleArticleHighlight}>
                <input type="hidden" name="id" value={params.id} />
                <button
                  type="submit"
                  className={`h-10 px-4 rounded-md text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center gap-2 transition-colors ${
                    data.is_highlight
                      ? "bg-navy text-zimba-gold hover:bg-zimba-blue"
                      : "border border-navy/30 text-navy hover:border-navy"
                  }`}
                  title={
                    data.is_highlight
                      ? "Já é destaque — clique pra tirar"
                      : "Marca como destaque na home"
                  }
                >
                  <span aria-hidden>{data.is_highlight ? "●" : "○"}</span>
                  {data.is_highlight ? "Destaque ativo" : "Marcar destaque"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <PersonaRewriter
          articleId={params.id}
          personas={personasLite}
          currentPersonaId={(data.persona_id as string | null) ?? null}
        />
      </div>

      <div className="mt-8">
        <HeroStudio
          articleId={params.id}
          articleTitle={data.title as string}
          articleLede={(data.lede as string | null) ?? null}
          heroImageUrl={(data.hero_image_url as string | null) ?? null}
          heroImageAlt={(data.hero_image_alt as string | null) ?? null}
          hasScoredOrigin={!!(data.scored_item_id as string | null)}
        />
      </div>

      <div className="mt-8">
        <SocialDistribution articleId={params.id} articlePublished={isPublished} />
      </div>

      {/* Preview de como a matéria vai sair no portal — irmão visual
          do pacote social, fica logo abaixo pra confirmar a versão
          final antes de publicar. */}
      <div className="mt-8">
        <ArticlePreview
          editoria={data.editoria as string}
          status={data.status as string | null}
          slug={(data.slug as string | null) ?? null}
          title={data.title as string}
          lede={(data.lede as string | null) ?? null}
          subtitle={(data.subtitle as string | null) ?? null}
          body={(data.body as string | null) ?? null}
          byline={(data.byline as string | null) ?? null}
          heroImageUrl={(data.hero_image_url as string | null) ?? null}
          heroImageAlt={(data.hero_image_alt as string | null) ?? null}
          heroImageCredit={(data.hero_image_credit as string | null) ?? null}
          videoUrl={(data.video_url as string | null) ?? null}
          isBreaking={!!(data.is_breaking as boolean | null)}
          isExclusive={!!(data.is_exclusive as boolean | null)}
          publishedAt={(data.published_at as string | null) ?? null}
          updatedAt={(data.updated_at as string | null) ?? null}
        />
      </div>

      {/* Formulário bruto — fica recolhido porque na edição em fluxo
          normal (reescrever com persona, regerar hero) o admin não
          precisa tocar nesses campos. Aberto quando alguém quer
          ajuste fino: tags, slug, agendamento, byline manual. */}
      <details className="mt-10 rounded-md border border-border-subtle bg-white open:shadow-z-1">
        <summary className="cursor-pointer select-none px-5 py-3 flex items-center justify-between gap-3 hover:bg-off-white">
          <span>
            <span className="block text-[10px] uppercase tracking-[0.28em] font-bold text-ink-500">
              ajuste fino
            </span>
            <span className="block font-display font-bold text-fs-15 text-navy mt-0.5">
              Campos brutos da matéria
            </span>
          </span>
          <span className="text-fs-12 text-ink-500">
            slug · tags · cidades · agendamento · byline manual ▾
          </span>
        </summary>
        <div className="border-t border-border-subtle p-5">
          <ArticleForm mode="edit" id={params.id} initial={data as Partial<ArticleRow>} />
        </div>
      </details>
    </>
  );
}
