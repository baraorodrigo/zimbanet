// Preview de como a matéria vai sair no portal. Mesmo "shell" de card
// que o painel SocialDistribution usa (border-zimba-blue/30, header
// gold/blue, body branco) — é o irmão visual da grade de redes sociais.
//
// Dois previews dentro do card:
//   1. Chamada na capa — duas variantes (card vertical e lista
//      horizontal), espelhando NewsCard e NewsCardList do portal.
//      No portal real o título NÃO fica sobreposto à foto (diferente
//      da legenda no Instagram) — fica embaixo, na tipografia Georgia.
//   2. Página da matéria — look-and-feel completo da `/[editoria]/[slug]`,
//      recolhido por padrão num <details> pra não dominar.

import Link from "next/link";
import Image from "next/image";
import VideoEmbed from "@/components/video-embed";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";

type Props = {
  editoria: string;
  status: string | null;
  slug: string | null;
  title: string;
  lede: string | null;
  subtitle: string | null;
  body: string | null;
  byline: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  heroImageCredit: string | null;
  videoUrl: string | null;
  isBreaking: boolean;
  isExclusive: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
};

function estimateReadingMinutes(body: string | null): number {
  if (!body) return 0;
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

function formatDateLabel(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fallback;
  }
}

export function ArticlePreview({
  editoria,
  status,
  slug,
  title,
  lede,
  subtitle,
  body,
  byline,
  heroImageUrl,
  heroImageAlt,
  heroImageCredit,
  videoUrl,
  isBreaking,
  isExclusive,
  publishedAt,
  updatedAt,
}: Props) {
  const label =
    EDITORIA_LABEL[editoria as EditoriaSlug] ?? editoria?.toUpperCase() ?? "—";
  const readingMin = estimateReadingMinutes(body);
  const wordCount = body ? body.trim().split(/\s+/).length : 0;
  const headDate = formatDateLabel(publishedAt ?? updatedAt, "agora");
  const paragraphs = (body ?? "").split(/\n\n+/).filter((p) => p.trim().length > 0);
  const isPublished = status === "published";
  const portalHref = slug ? `/${editoria}/${slug}` : null;

  return (
    <section
      aria-labelledby="article-preview-title"
      className="rounded-md border-2 border-zimba-blue/30 bg-white overflow-hidden"
    >
      {/* Header — mesmo padrão visual do social-panel pra deixar claro
          que é "mais um card de preview". */}
      <header className="px-5 py-3 bg-zimba-blue/5 border-b border-zimba-blue/20 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-blue">
            Preview do portal
          </p>
          <h2
            id="article-preview-title"
            className="font-display font-black text-fs-20 text-navy leading-tight mt-0.5"
          >
            👁 Como vai sair pro leitor
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-xs text-[10px] uppercase tracking-[0.22em] font-bold border ${
              isPublished
                ? "bg-eco-green text-white border-eco-green"
                : "bg-white/60 text-ink-500 border-border-subtle"
            }`}
          >
            {isPublished ? "✓ no ar" : "rascunho"}
          </span>
          {isPublished && portalHref && (
            <Link
              href={portalHref}
              target="_blank"
              className="text-fs-12 text-ink-500 hover:text-navy underline-offset-2 hover:underline"
            >
              ver no portal ↗
            </Link>
          )}
        </div>
      </header>

      {/* Mini-resumo — sempre visível, leve. Headline + métricas. */}
      <div className="px-5 py-4 border-b border-border-subtle bg-off-white/40">
        <div className="flex flex-wrap items-baseline gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold">
            {label}
          </span>
          {isBreaking && (
            <span className="rounded-xs bg-alert-red px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.18em] text-white">
              Breaking
            </span>
          )}
          {isExclusive && (
            <span className="rounded-xs bg-zimba-gold px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.18em] text-navy">
              ★ Exclusivo
            </span>
          )}
        </div>
        <p className="font-display font-bold text-fs-16 text-navy leading-snug">
          {title || (
            <span className="text-ink-300 italic font-normal">
              (matéria sem título)
            </span>
          )}
        </p>
        <p className="mt-2 text-fs-12 text-ink-500 font-mono">
          {wordCount} palavras · {readingMin || 0} min de leitura ·{" "}
          {heroImageUrl ? "com hero" : "⚠ sem hero"} ·{" "}
          {paragraphs.length} parágrafos no corpo
        </p>
      </div>

      {/* Chamada na capa — espelha NewsCard (grid) e NewsCardList (lista
          horizontal). Sem Link real porque é só preview. No portal o
          título fica EMBAIXO da foto, não sobreposto. */}
      <div className="px-5 py-5 border-b border-border-subtle bg-white">
        <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-blue mb-3">
          Chamada na capa
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FeedCardPreview
            label={label}
            title={title}
            lede={lede}
            subtitle={subtitle}
            byline={byline}
            headDate={headDate}
            heroImageUrl={heroImageUrl}
            heroImageAlt={heroImageAlt}
            isBreaking={isBreaking}
            isExclusive={isExclusive}
          />
          <FeedListPreview
            label={label}
            title={title}
            byline={byline}
            headDate={headDate}
            heroImageUrl={heroImageUrl}
            heroImageAlt={heroImageAlt}
            isBreaking={isBreaking}
          />
        </div>
        <p className="mt-3 text-fs-11 text-ink-400 leading-relaxed">
          ✦ No portal real a foto entra <code className="font-mono">16:9</code> e o
          título fica abaixo (Georgia black). Nada sobreposto — diferente da
          legenda overlay dos cards de Instagram.
        </p>
      </div>

      {/* Look-and-feel completo da página /[editoria]/[slug] —
          recolhido por padrão pra não dominar. */}
      <details className="group">
        <summary className="cursor-pointer select-none px-5 py-3 flex items-center justify-between gap-3 hover:bg-off-white text-fs-13 text-ink-700">
          <span className="font-bold">
            🖥 Abrir preview da página da matéria
          </span>
          <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>

        <div className="bg-off-white px-6 py-8 border-t border-border-subtle">
          <article className="mx-auto max-w-[640px]">
            {/* Cabeçalho */}
            <div className="mb-6 border-b border-border-subtle pb-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-sans text-fs-11 font-bold uppercase tracking-[0.22em] text-zimba-gold">
                  {label}
                </span>
                {isBreaking && (
                  <span className="rounded-xs bg-alert-red px-2 py-[3px] font-sans text-fs-10 font-bold uppercase tracking-[0.18em] text-white">
                    Breaking
                  </span>
                )}
                {isExclusive && (
                  <span className="rounded-xs bg-zimba-gold px-2 py-[3px] font-sans text-fs-10 font-bold uppercase tracking-[0.18em] text-navy">
                    ★ Exclusivo
                  </span>
                )}
              </div>

              <h3 className="font-display text-fs-28 lg:text-fs-32 font-black leading-tight tracking-tight2 text-navy text-balance">
                {title || (
                  <span className="text-ink-300 italic font-normal">
                    (matéria sem título)
                  </span>
                )}
              </h3>

              {(subtitle || lede) && (
                <p className="mt-4 max-w-[58ch] font-display text-fs-16 lg:text-fs-17 leading-snug text-ink-700 text-pretty">
                  {subtitle ?? lede}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-fs-12 text-ink-500">
                <span className="text-navy font-medium">
                  Por {byline?.trim() || "Redação Zimbanet"}
                </span>
                <span className="text-ink-300">·</span>
                <span>{headDate}</span>
                {readingMin > 0 && (
                  <>
                    <span className="text-ink-300">·</span>
                    <span>{readingMin} min de leitura</span>
                  </>
                )}
              </div>
            </div>

            {videoUrl ? (
              <figure className="mb-6">
                <VideoEmbed url={videoUrl} />
                {heroImageCredit && (
                  <figcaption className="mt-2 font-sans text-fs-11 text-ink-500">
                    {heroImageCredit}
                  </figcaption>
                )}
              </figure>
            ) : heroImageUrl ? (
              <figure className="mb-6">
                <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-ink-100">
                  <Image
                    src={heroImageUrl}
                    alt={heroImageAlt ?? title}
                    fill
                    sizes="640px"
                    className="object-cover"
                  />
                </div>
                {heroImageCredit && (
                  <figcaption className="mt-2 font-sans text-fs-11 text-ink-500">
                    {heroImageCredit}
                  </figcaption>
                )}
              </figure>
            ) : (
              <div className="mb-6 flex aspect-[16/9] items-center justify-center rounded-md border-2 border-dashed border-alert-red/30 bg-alert-red/5">
                <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-alert-red">
                  ⚠ sem hero — vai sair sem imagem no topo
                </p>
              </div>
            )}

            {paragraphs.length > 0 ? (
              <div className="font-display text-fs-15 lg:text-fs-16 leading-[1.7] text-navy">
                {paragraphs.map((para, i) => (
                  <p key={i} className="mb-4">
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-alert-red/30 bg-alert-red/5 p-5 font-sans text-fs-13 text-alert-red">
                ⚠ Corpo vazio. Sem texto, a matéria não tem conteúdo pra publicar.
              </p>
            )}
          </article>
        </div>
      </details>
    </section>
  );
}

// ─── Previews da chamada na capa ────────────────────────────────────────
// Espelham NewsCard e NewsCardList do portal, mas estáticos (sem Link).
// Importante: no portal o título NÃO é sobreposto à foto — fica EMBAIXO,
// em Georgia black. A foto entra 16:9 limpa, sem overlay.

type FeedCardProps = {
  label: string;
  title: string;
  lede: string | null;
  subtitle: string | null;
  byline: string | null;
  headDate: string;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  isBreaking: boolean;
  isExclusive: boolean;
};

function FeedCardPreview({
  label,
  title,
  lede,
  subtitle,
  byline,
  headDate,
  heroImageUrl,
  heroImageAlt,
  isBreaking,
  isExclusive,
}: FeedCardProps) {
  const dek = subtitle ?? lede;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-400 mb-2">
        Card vertical (grade da capa)
      </p>
      <article className="bg-white border border-border-subtle rounded-md overflow-hidden">
        <div className="relative aspect-[16/9] bg-ink-100">
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageUrl}
              alt={heroImageAlt ?? title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-alert-red/5 border-2 border-dashed border-alert-red/30">
              <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-alert-red">
                ⚠ sem foto
              </p>
            </div>
          )}
          {isExclusive && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-zimba-gold text-navy text-[11px] font-bold uppercase tracking-[0.18em] px-2 py-[3px] rounded-xs">
              ★ Exclusivo
            </span>
          )}
          {isBreaking && (
            <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-alert-red text-white text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-[3px] rounded-xs">
              Breaking
            </span>
          )}
        </div>
        <div className="p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-2">
            {label}
          </p>
          <h4 className="font-display font-bold text-fs-20 leading-snug text-navy text-balance">
            {title || (
              <span className="text-ink-300 italic font-normal">
                (matéria sem título)
              </span>
            )}
          </h4>
          {dek && (
            <p className="mt-2 text-fs-14 text-ink-700 leading-relaxed line-clamp-2">
              {dek}
            </p>
          )}
          <div className="mt-4 text-fs-13 text-ink-500 font-medium">
            {byline?.trim() ? `${byline.trim()} · ` : ""}
            {headDate}
          </div>
        </div>
      </article>
    </div>
  );
}

type FeedListProps = {
  label: string;
  title: string;
  byline: string | null;
  headDate: string;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  isBreaking: boolean;
};

function FeedListPreview({
  label,
  title,
  byline,
  headDate,
  heroImageUrl,
  heroImageAlt,
  isBreaking,
}: FeedListProps) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-400 mb-2">
        Card horizontal (lista lateral)
      </p>
      <article className="bg-white border border-border-subtle rounded-md overflow-hidden">
        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr]">
          <div className="relative aspect-[4/3] bg-ink-100">
            {heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImageUrl}
                alt={heroImageAlt ?? title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-alert-red/5 border-2 border-dashed border-alert-red/30">
                <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-alert-red text-center px-2">
                  ⚠ sem foto
                </p>
              </div>
            )}
            {isBreaking && (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-alert-red text-white text-[9px] font-bold uppercase tracking-[0.18em] px-1.5 py-[2px] rounded-xs">
                Breaking
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-1.5">
              {label}
            </p>
            <h4 className="font-display font-bold text-fs-16 sm:text-fs-18 leading-snug text-navy text-balance">
              {title || (
                <span className="text-ink-300 italic font-normal">
                  (matéria sem título)
                </span>
              )}
            </h4>
            <div className="mt-2 text-fs-12 text-ink-500 font-medium">
              {byline?.trim() ? `${byline.trim()} · ` : ""}
              {headDate}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
