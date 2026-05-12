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
 * Horizontal list-style card — photo on the left, content on the right.
 * Mirrors `.zb-card-list` from the spec.
 */
export default function NewsCardList({
  article,
  seed = 0,
}: {
  article: Article;
  seed?: number;
}) {
  const slug = slugFromLabel(article.editoria);
  const href = `/${slug}/${article.slug}`;
  return (
    <article className="group bg-white border border-border-subtle rounded-md overflow-hidden hover:shadow-z-2 transition-shadow">
      <Link href={href} className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr]">
        <div className="relative aspect-[4/3] bg-ink-100">
          <PhotoFill
            src={article.image}
            alt={article.imageAlt}
            seed={seed}
            sizes="160px"
          />
          {article.isBreaking && (
            <span className="zb-badge-live absolute top-2 left-2">Breaking</span>
          )}
        </div>
        <div className="p-4">
          <EditoriaChip editoria={slug} size="sm" className="mb-1.5" />
          <h3 className="mt-1.5 font-display font-bold text-fs-16 sm:text-fs-18 leading-snug text-navy group-hover:text-zimba-blue transition-colors text-balance">
            {article.title}
          </h3>
          <div className="mt-2 text-fs-12 text-ink-500 font-medium">
            {article.author ? `${article.author} · ` : ""}
            {article.publishedAt}
          </div>
        </div>
      </Link>
    </article>
  );
}
