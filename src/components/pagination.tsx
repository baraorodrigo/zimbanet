import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  baseHref: string; // ex: "/cidade" ou "/buscar?q=foo" (sem &p / ?p)
};

function buildHref(base: string, page: number): string {
  if (page <= 1) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}p=${page}`;
}

// Janela de páginas: 1 … (cur-1) cur (cur+1) … last
function pagesWindow(cur: number, last: number): (number | "ellipsis")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const out: (number | "ellipsis")[] = [1];
  const start = Math.max(2, cur - 1);
  const end = Math.min(last - 1, cur + 1);
  if (start > 2) out.push("ellipsis");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < last - 1) out.push("ellipsis");
  out.push(last);
  return out;
}

export default function Pagination({ page, totalPages, baseHref }: Props) {
  if (totalPages <= 1) return null;
  const window = pagesWindow(page, totalPages);

  return (
    <nav
      aria-label="Paginação"
      className="mt-10 flex flex-wrap items-center justify-center gap-2 font-sans text-fs-13"
    >
      {page > 1 ? (
        <Link
          href={buildHref(baseHref, page - 1)}
          rel="prev"
          aria-label="Página anterior"
          className="rounded-xs border border-navy/15 bg-white px-3 h-9 inline-flex items-center text-navy/80 font-semibold hover:border-zimba-gold hover:text-navy transition-colors"
        >
          ← Anterior
        </Link>
      ) : (
        <span
          aria-disabled
          className="rounded-xs border border-navy/10 bg-white px-3 h-9 inline-flex items-center text-ink-400 font-semibold cursor-not-allowed"
        >
          ← Anterior
        </span>
      )}

      <ul className="flex flex-wrap items-center gap-1.5">
        {window.map((p, i) =>
          p === "ellipsis" ? (
            <li key={`e${i}`} aria-hidden className="px-2 text-ink-400">
              …
            </li>
          ) : (
            <li key={p}>
              {p === page ? (
                <span
                  aria-current="page"
                  className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xs bg-zimba-gold text-navy font-bold tabular-nums"
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={buildHref(baseHref, p)}
                  className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xs bg-white border border-navy/15 text-navy/80 hover:border-zimba-gold hover:text-navy transition-colors tabular-nums font-semibold"
                >
                  {p}
                </Link>
              )}
            </li>
          ),
        )}
      </ul>

      {page < totalPages ? (
        <Link
          href={buildHref(baseHref, page + 1)}
          rel="next"
          aria-label="Próxima página"
          className="rounded-xs border border-navy/15 bg-white px-3 h-9 inline-flex items-center text-navy/80 font-semibold hover:border-zimba-gold hover:text-navy transition-colors"
        >
          Próxima →
        </Link>
      ) : (
        <span
          aria-disabled
          className="rounded-xs border border-navy/10 bg-white px-3 h-9 inline-flex items-center text-ink-400 font-semibold cursor-not-allowed"
        >
          Próxima →
        </span>
      )}
    </nav>
  );
}
