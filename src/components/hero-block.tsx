import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { slugFromLabel } from "@/lib/db/types";
import Icon from "./icon";

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
 * Hero — split layout: photo on the left, dark navy content card on the right.
 * Mirrors `.zb-hero` from the design spec.
 */
export default function HeroBlock({ main }: { main: Article }) {
  return (
    <article className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] rounded-lg overflow-hidden shadow-z-2 bg-navy">
      <Link
        href={`/${slugFromLabel(main.editoria)}/${main.slug}`}
        className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[440px] block group"
        aria-label={main.title}
      >
        <PhotoFill
          src={main.image}
          alt={main.imageAlt}
          seed={1}
          priority
          sizes="(min-width: 1024px) 620px, 100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/35 via-transparent to-transparent" />
      </Link>

      <div className="p-8 lg:p-10 flex flex-col justify-center text-off-white bg-navy">
        <div className="mb-3 inline-flex items-center gap-2">
          <span className="zb-badge-live">Ao vivo</span>
        </div>
        <span className="text-fs-12 uppercase tracking-tag font-bold text-zimba-gold mb-3">
          Especial · {main.editoria.charAt(0) + main.editoria.slice(1).toLowerCase()}
        </span>
        <h1 className="font-display font-black text-fs-44 lg:text-fs-56 leading-tight tracking-tight2 text-balance">
          <Link href={`/${slugFromLabel(main.editoria)}/${main.slug}`} className="hover:text-zimba-gold transition-colors">
            {main.title}
          </Link>
        </h1>
        {main.lede && (
          <p className="mt-4 text-fs-18 text-off-white/85 leading-relaxed text-pretty max-w-[44ch]">
            {main.lede}
          </p>
        )}
        <div className="mt-6 inline-flex items-center gap-2 text-fs-13 text-off-white/65 font-medium">
          <Icon name="user" size={14} />
          <span>Por {main.author ?? "Redação Zimbanet"}</span>
          <span className="text-off-white/30">·</span>
          <Icon name="clock" size={14} />
          <span>{main.publishedAt}</span>
        </div>
      </div>
    </article>
  );
}
