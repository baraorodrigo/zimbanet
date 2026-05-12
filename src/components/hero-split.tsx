import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { slugFromLabel } from "@/lib/db/types";
import Icon from "./icon";
import EditoriaChip from "./editoria-chip";

function PhotoFill({
  src,
  alt,
  seed = 0,
  priority,
  sizes,
}: {
  src?: string;
  alt?: string;
  seed?: number;
  priority?: boolean;
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
        priority={priority}
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
 * Split hero — manchete (foto + título + lede + meta) à esquerda + 3 chamadas à direita.
 * Mirrors `.zb-hero-split` + `.zb-chamada` from the spec — "newspaper above-the-fold".
 */
export default function HeroSplit({
  main,
  chamadas,
}: {
  main: Article;
  chamadas: Article[];
}) {
  const mainSlug = slugFromLabel(main.editoria);
  const mainHref = `/${mainSlug}/${main.slug}`;
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 lg:gap-8 mt-6">
      {/* Manchete principal */}
      <article className="cursor-pointer group">
        <Link href={mainHref} aria-label={main.title}>
          <div className="relative aspect-[16/10] rounded-sm overflow-hidden mb-4 bg-ink-100">
            <PhotoFill
              src={main.image}
              alt={main.imageAlt}
              seed={1}
              priority
              sizes="(min-width: 1024px) 720px, 100vw"
            />
            {main.isBreaking && (
              <span className="zb-badge-live absolute top-4 left-4">Breaking</span>
            )}
          </div>
        </Link>

        <EditoriaChip editoria={mainSlug} className="mb-2.5" />
        <h1 className="mt-2.5 font-display font-black text-fs-34 lg:text-fs-44 leading-tight tracking-tight2 text-navy text-balance">
          <Link
            href={mainHref}
            className="hover:text-zimba-blue transition-colors"
          >
            {main.title}
          </Link>
        </h1>
        {main.lede && (
          <p className="mt-3 text-fs-18 text-ink-700 leading-relaxed text-pretty max-w-[60ch]">
            {main.lede}
          </p>
        )}
        <div className="mt-4 inline-flex items-center gap-2 text-fs-13 text-ink-500 font-medium">
          <Icon name="user" size={14} />
          <span>Por {main.author ?? "Redação Zimbanet"}</span>
          <span className="text-ink-300">·</span>
          <Icon name="clock" size={14} />
          <span>{main.publishedAt}</span>
        </div>
      </article>

      {/* Coluna de chamadas — top border navy, dashed dividers.
          Em mobile (<sm) escondo o thumb pra dar espaço pro título; o hero
          principal já entrega contexto visual suficiente acima. */}
      <div className="border-t-2 border-navy">
        {chamadas.slice(0, 4).map((c, i) => {
          const cSlug = slugFromLabel(c.editoria);
          return (
            <Link
              key={c.id}
              href={`/${cSlug}/${c.slug}`}
              className="grid grid-cols-[1fr] sm:grid-cols-[1fr_88px] gap-3.5 py-4 border-b border-border-subtle last:border-b-0 cursor-pointer group"
            >
              <div className="min-w-0">
                <EditoriaChip editoria={cSlug} size="sm" className="mb-1.5" />
                <h3 className="mt-1.5 font-display font-bold text-fs-16 leading-snug text-navy group-hover:text-zimba-blue transition-colors text-balance">
                  {c.title}
                </h3>
                <div className="mt-1.5 text-[11px] text-ink-500 font-medium">
                  {c.author ? `${c.author} · ` : ""}
                  {c.publishedAt}
                </div>
              </div>
              <div className="hidden sm:block relative aspect-square rounded-sm overflow-hidden bg-ink-100 shrink-0">
                <PhotoFill
                  src={c.image}
                  alt={c.imageAlt}
                  seed={i + 2}
                  sizes="88px"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
