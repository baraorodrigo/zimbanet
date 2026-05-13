import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { slugFromLabel } from "@/lib/db/types";
import { parseVideoUrl } from "./video-embed";
import EditoriaChip from "./editoria-chip";
import SectionHead from "./section-head";

const PROVIDER_LABEL: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

function VideoCard({ article, seed = 0 }: { article: Article; seed?: number }) {
  const slug = slugFromLabel(article.editoria);
  const href = `/${slug}/${article.slug}`;
  const parsed = parseVideoUrl(article.videoUrl);
  const providerLabel = parsed ? PROVIDER_LABEL[parsed.provider] : null;
  const x = 20 + ((seed * 17) % 60);
  const y = 30 + ((seed * 41) % 60);

  return (
    <article className="group snap-start shrink-0 w-[280px] md:w-auto bg-white border border-border-subtle rounded-md overflow-hidden hover:shadow-z-2 transition-shadow">
      <Link href={href} className="block">
        <div className="relative aspect-[16/9] bg-ink-100">
          {article.image ? (
            <Image
              src={article.image}
              alt={article.imageAlt ?? ""}
              fill
              sizes="(min-width: 1024px) 240px, 280px"
              className="object-cover"
            />
          ) : (
            <div
              className="zb-photo absolute inset-0"
              style={{ ["--patx" as string]: `${x}%`, ["--paty" as string]: `${y}%` }}
              aria-hidden
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-navy/85 text-zimba-gold text-fs-20 shadow-z-2 ring-1 ring-white/20 transition-transform group-hover:scale-105">
              ▶
            </span>
          </span>
          {providerLabel && (
            <span className="absolute top-3 right-3 bg-alert-red text-white text-[10px] font-bold uppercase tracking-tag px-2 py-[3px] rounded-xs shadow-z-1">
              {providerLabel}
            </span>
          )}
        </div>
        <div className="p-4">
          <EditoriaChip editoria={slug} className="mb-2" />
          <h3 className="mt-2 font-display font-bold text-fs-17 leading-snug text-navy group-hover:text-zimba-blue transition-colors line-clamp-3 text-balance">
            {article.title}
          </h3>
          <div className="mt-3 text-fs-13 text-ink-500 font-medium">
            {article.publishedAt}
          </div>
        </div>
      </Link>
    </article>
  );
}

/**
 * Hub de vídeos da home — matérias publicadas com video_url. Mobile rola
 * horizontalmente com scroll-snap; desktop vira grid de 4 colunas. Some
 * inteiro se não houver vídeos (evita seção vazia poluindo a home).
 */
export default function VideoHubSection({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  return (
    <section aria-label="Vídeos">
      <SectionHead title="Em vídeo" link={null} />
      <div className="md:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-4 pb-2">
          {articles.slice(0, 8).map((a, i) => (
            <VideoCard key={a.id} article={a} seed={i + 20} />
          ))}
        </div>
      </div>
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {articles.slice(0, 4).map((a, i) => (
          <VideoCard key={a.id} article={a} seed={i + 20} />
        ))}
      </div>
    </section>
  );
}
