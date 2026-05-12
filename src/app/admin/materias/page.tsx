import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";
import { getArticleSourceUrls } from "@/lib/db/articles";
import { Header } from "../_components/header";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "rascunho",
  review: "revisão",
  scheduled: "agendado",
  published: "publicado",
  rejected: "rejeitado",
  archived: "arquivado",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-ink-100 text-ink-700",
  review: "bg-gold-100 text-gold-700",
  scheduled: "bg-zimba-blue/10 text-zimba-blue",
  published: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-ink-100 text-ink-500",
};

type SP = { status?: string; editoria?: string };

export default async function MateriasIndex({ searchParams }: { searchParams?: SP }) {
  const supabase = createClient();

  let q = supabase
    .from("articles")
    .select("id, title, slug, editoria, status, byline, updated_at, published_at, is_cover, is_highlight")
    .order("updated_at", { ascending: false })
    .limit(80);

  if (searchParams?.status) q = q.eq("status", searchParams.status);
  if (searchParams?.editoria) q = q.eq("editoria", searchParams.editoria);

  const { data, error } = await q;
  const items = data ?? [];
  const sourceMap = await getArticleSourceUrls(items.map((a) => a.id as string));

  return (
    <>
      <Header
        kicker="Acervo"
        title="Matérias"
        sub={`${items.length} matéria${items.length === 1 ? "" : "s"} ${
          searchParams?.status ? `em "${STATUS_LABEL[searchParams.status] ?? searchParams.status}"` : "no total"
        }.`}
      />

      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <FilterBar current={searchParams ?? {}} />
        <div className="flex items-center gap-2">
          <Link
            href="/admin/materias/importar"
            className="h-10 px-4 rounded-md bg-white border border-navy text-navy font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors inline-flex items-center gap-1.5"
            title="Cola uma URL e eu extraio título, foto e corpo"
          >
            <span aria-hidden>🔗</span> Importar de link
          </Link>
          <Link
            href="/admin/materias/nova"
            className="h-10 px-4 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors inline-flex items-center"
          >
            + Nova matéria
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          {error.message}
        </div>
      )}

      <div className="mt-6 rounded-md border border-border-subtle bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-display font-black text-fs-18 text-navy">Nenhuma matéria</p>
            <p className="mt-1 text-fs-13 text-ink-500">
              Mude o filtro ou crie a primeira.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {items.map((a) => {
              const src = sourceMap.get(a.id as string);
              return (
                <li
                  key={a.id as string}
                  className="grid grid-cols-[80px_1fr_140px_120px_140px] gap-4 items-center px-4 py-3 hover:bg-off-white transition-colors"
                >
                  <Link
                    href={`/admin/materias/${a.id}`}
                    className="contents"
                  >
                    <span
                      className={`inline-flex justify-center text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-1 ${
                        STATUS_BADGE[a.status as string] ?? STATUS_BADGE.draft
                      }`}
                    >
                      {STATUS_LABEL[a.status as string] ?? a.status}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-fs-15 text-navy truncate flex items-center gap-2">
                        {a.is_cover && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.22em] font-bold bg-zimba-gold text-navy px-1.5 py-0.5 rounded-xs"
                            title="Marcada como capa da home"
                          >
                            ★ Capa
                          </span>
                        )}
                        {a.is_highlight && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.22em] font-bold bg-navy text-zimba-gold px-1.5 py-0.5 rounded-xs"
                            title="Destaque na home"
                          >
                            ● Destaque
                          </span>
                        )}
                        <span className="truncate">{a.title}</span>
                      </p>
                      {a.byline && (
                        <p className="text-fs-12 text-ink-500 mt-0.5">por {a.byline}</p>
                      )}
                    </div>
                  </Link>
                  {src ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-bold text-zimba-blue hover:text-navy min-w-0"
                      title={src.url}
                    >
                      📰
                      {src.host && (
                        <span className="font-mono normal-case tracking-normal text-ink-500 truncate">
                          {src.host}
                        </span>
                      )}
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={`/admin/materias/${a.id}`}
                    className="text-fs-12 font-semibold uppercase tracking-[0.16em] text-ink-700 hover:text-navy"
                  >
                    {EDITORIA_LABEL[a.editoria as EditoriaSlug] ?? a.editoria}
                  </Link>
                  <Link
                    href={`/admin/materias/${a.id}`}
                    className="text-fs-12 text-ink-500 text-right hover:text-navy"
                  >
                    {new Date(a.updated_at as string).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function FilterBar({ current }: { current: SP }) {
  const statuses: Array<{ k: string; l: string }> = [
    { k: "", l: "Todas" },
    { k: "draft", l: "Rascunho" },
    { k: "review", l: "Revisão" },
    { k: "published", l: "Publicado" },
    { k: "rejected", l: "Rejeitado" },
  ];
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {statuses.map((s) => {
        const active = (current.status ?? "") === s.k;
        const params = new URLSearchParams();
        if (s.k) params.set("status", s.k);
        if (current.editoria) params.set("editoria", current.editoria);
        const href = `/admin/materias${params.toString() ? "?" + params.toString() : ""}`;
        return (
          <Link
            key={s.k || "all"}
            href={href}
            className={`text-[11px] uppercase tracking-[0.22em] font-bold px-3 h-9 inline-flex items-center rounded ${
              active
                ? "bg-navy text-zimba-gold"
                : "bg-white border border-border-subtle text-ink-700 hover:border-navy"
            }`}
          >
            {s.l}
          </Link>
        );
      })}
    </div>
  );
}
