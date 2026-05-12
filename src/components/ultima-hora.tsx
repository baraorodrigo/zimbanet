import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { slugFromLabel } from "@/lib/db/types";

/**
 * Última hora — list dense, monospace red timestamps + Georgia headlines.
 * Mirrors `.zb-ultima` from the spec. Ideal pra abrir a homepage.
 */
export default function UltimaHora({ items }: { items: Article[] }) {
  if (!items.length) return null;
  return (
    <section>
      <div className="zb-section-titlebar">
        <span className="label red">Última hora</span>
        <span className="extra">
          atualizado agora
          <Link href="/cidade">ver todas</Link>
        </span>
      </div>
      <div className="zb-ultima">
        {items.slice(0, 5).map((it) => (
          <Link
            key={it.id}
            href={`/${slugFromLabel(it.editoria)}/${it.slug}`}
            className="zb-ultima-item"
          >
            <span className="zb-ultima-time">{shortTime(it.publishedAt)}</span>
            <h3 className="zb-ultima-headline">{it.title}</h3>
          </Link>
        ))}
      </div>
    </section>
  );
}

function shortTime(rel: string): string {
  // "há 12 min" → "12m" · "há 3h" → "3h" · "ontem" → "1d" · default → primeiros 5 chars
  const min = rel.match(/(\d+)\s*min/i);
  if (min) return `${min[1]}m`;
  const h = rel.match(/(\d+)\s*h/i);
  if (h) return `${h[1]}h`;
  if (/ontem/i.test(rel)) return "1d";
  if (/agora/i.test(rel)) return "now";
  return rel.slice(0, 5);
}
