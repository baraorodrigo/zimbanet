import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { slugFromLabel } from "@/lib/db/types";
import EditoriaChip from "./editoria-chip";

function PhotoFill({
  src,
  alt,
  seed = 0,
  sizes,
}: {
  src?: string;
  alt?: string;
  seed?: number;
  sizes?: string;
}) {
  const x = 20 + ((seed * 17) % 60);
  const y = 30 + ((seed * 41) % 60);
  if (src) {
    return (
      <Image
        src={src}
        alt={alt ?? ""}
        fill
        sizes={sizes}
        className="object-cover"
      />
    );
  }
  return (
    <div
      className="zb-photo absolute inset-0"
      style={{ ["--patx" as string]: `${x}%`, ["--paty" as string]: `${y}%` }}
      aria-hidden
    />
  );
}

/**
 * Standard story card — photo on top, kicker / headline / lede / meta below.
 * Mirrors `.zb-card` / `.zb-card-md` from the design spec.
 */
export default function NewsCard({
  article,
  seed = 0,
  badge,
}: {
  article: Article;
  seed?: number;
  badge?: "exclusivo" | "destaque";
}) {
  const slug = slugFromLabel(article.editoria);
  const href = `/${slug}/${article.slug}`;
  return (
    <article className="group bg-white border border-border-subtle rounded-md overflow-hidden hover:shadow-z-2 transition-shadow">
      <Link href={href} className="block">
        <div className="relative aspect-[16/9] bg-ink-100">
          <PhotoFill
            src={article.image}
            alt={article.imageAlt}
            seed={seed}
            sizes="(min-width: 1024px) 360px, 100vw"
          />
          {article.isBreaking && (
            <span className="zb-badge-live absolute top-3 left-3">Breaking</span>
          )}
          {badge === "exclusivo" && !article.isBreaking && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-zimba-gold text-navy text-[11px] font-bold uppercase tracking-tag px-2 py-[3px] rounded-xs">
              ★ Exclusivo
            </span>
          )}
        </div>
        <div className="p-5">
          <EditoriaChip editoria={slug} className="mb-2" />
          <h3 className="mt-2 font-display font-bold text-fs-20 leading-snug text-navy group-hover:text-zimba-blue transition-colors text-balance">
            {article.title}
          </h3>
          {article.lede && (
            <p className="mt-2 text-fs-14 text-ink-700 leading-relaxed line-clamp-2">
              {article.lede}
            </p>
          )}
          <div className="mt-4 text-fs-13 text-ink-500 font-medium">
            {article.author ? `${article.author} · ` : ""}
            {article.publishedAt}
          </div>
        </div>
      </Link>
    </article>
  );
}
