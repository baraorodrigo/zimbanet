import Link from "next/link";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";
import { PackButton } from "./pack-button";

type Props = {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  articleStatus: string;
  editoria: EditoriaSlug;
  packCount: number;
  sourceUrl?: string | null;
};

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Header fixo do estúdio — ZIMBANET ⌁ ESTÚDIO em display, breadcrumb pequeno
// embaixo. Mora dentro da grid principal mas com fundo branco e separador grosso.
export function StudioHeader({
  articleId,
  articleTitle,
  articleSlug,
  articleStatus,
  editoria,
  packCount,
  sourceUrl,
}: Props) {
  const sourceHost = sourceUrl ? hostnameOf(sourceUrl) : null;
  return (
    <div className="border-b border-border-subtle bg-white">
      <div className="px-6 lg:px-8 py-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="min-w-0 flex-1">
          {/* Brand strip */}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] font-bold">
            <span className="text-navy">ZIMBANET</span>
            <span className="text-zimba-gold" aria-hidden>
              ⌁
            </span>
            <span className="text-zimba-gold">ESTÚDIO</span>
          </div>

          {/* Breadcrumb */}
          <nav
            aria-label="Onde você está"
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-fs-12 text-ink-500"
          >
            <Link href="/admin" className="hover:text-navy">
              Painel
            </Link>
            <span aria-hidden>/</span>
            <Link href="/admin/social" className="hover:text-navy">
              Social
            </Link>
            <span aria-hidden>/</span>
            <Link
              href={`/admin/materias/${articleId}`}
              className="hover:text-navy max-w-[40ch] truncate"
              title={articleTitle}
            >
              {articleTitle}
            </Link>
          </nav>

          {/* Título grande da matéria */}
          <h1 className="mt-2 font-display font-black text-fs-20 text-navy leading-tight max-w-[80ch] truncate">
            {articleTitle}
          </h1>

          {/* Meta */}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] font-bold">
            <span className="text-zimba-gold">{EDITORIA_LABEL[editoria] ?? editoria}</span>
            <span className="text-ink-400">·</span>
            <span className="text-ink-500">{articleStatus}</span>
            <span className="text-ink-400">·</span>
            <span className="text-ink-500">
              {packCount} {packCount === 1 ? "post" : "posts"} no pacote
            </span>
            <span className="text-ink-400">·</span>
            <span className="font-mono normal-case tracking-normal text-ink-400 text-fs-12">
              /{articleSlug}
            </span>
          </div>
        </div>

        {/* Ações globais */}
        <div className="flex items-center gap-2 shrink-0">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-zimba-gold bg-zimba-gold/10 text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold transition-colors"
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
          <Link
            href="/admin/configuracoes"
            className="h-9 px-3 inline-flex items-center rounded-md border border-border-subtle text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold hover:border-zimba-gold hover:text-navy transition-colors"
            title="Rotacionar chaves de IA"
          >
            🔑 Chaves
          </Link>
          <PackButton articleId={articleId} />
          <Link
            href={`/admin/materias/${articleId}#reescrever`}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border-2 border-zimba-gold text-navy bg-white text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold transition-colors"
            title="Reescrever texto da matéria com uma persona editorial"
          >
            ✍️ Reescrever texto
          </Link>
          <Link
            href={`/admin/materias/${articleId}`}
            className="h-9 px-4 inline-flex items-center rounded-md border border-border-subtle text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:border-navy transition-colors"
          >
            Ver matéria
          </Link>
          <Link
            href="/admin/social"
            className="h-9 px-4 inline-flex items-center rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold hover:text-navy transition-colors"
          >
            ← Inbox
          </Link>
        </div>
      </div>
    </div>
  );
}
