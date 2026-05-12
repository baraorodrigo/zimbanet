import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import Icon from "@/components/icon";
import ScamWarning from "@/components/scam-warning";
import { fetchBazarItemById } from "@/lib/db/community";
import { bazarItems, type BazarItem } from "@/lib/mock-data";

// ISR: anúncio público, revalida a cada 60s
export const revalidate = 60;

const typeStyles: Record<BazarItem["type"], string> = {
  Vende: "bg-zimba-gold text-navy",
  Doa: "bg-eco-green text-off-white",
  Troca: "bg-zimba-blue text-off-white",
  Procura: "bg-alert-red text-off-white",
};

const priceColor: Record<BazarItem["type"], string> = {
  Vende: "text-navy",
  Doa: "text-eco-green",
  Troca: "text-zimba-blue",
  Procura: "text-alert-red",
};

async function loadItem(id: string): Promise<BazarItem | null> {
  const real = await fetchBazarItemById(id);
  if (real) return real;
  return bazarItems.find((b) => b.id === id) ?? null;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zimbanet.com";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const item = await loadItem(params.id);
  if (!item) return { title: "Anúncio não encontrado · ZIMBANET" };
  const description = item.description ?? `${item.type} em ${item.bairro} — ${item.price}`;
  const ogParams = new URLSearchParams({
    title: item.title,
    editoria: "#BAZARDAZIMBA",
    kicker: `${item.type} · ${item.bairro}`,
  });
  const ogImage = item.photo_url ?? `${SITE}/api/og?${ogParams.toString()}`;
  return {
    title: `${item.title} · #bazardazimba · ZIMBANET`,
    description,
    openGraph: {
      title: item.title,
      description,
      url: `${SITE}/bazardazimba/${item.id}`,
      siteName: "ZIMBANET",
      type: "website",
      locale: "pt_BR",
      images: [{ url: ogImage, width: 1200, height: 630, alt: item.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function BazarDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const item = await loadItem(params.id);
  if (!item) notFound();

  const waNumber = item.whatsapp ? item.whatsapp.replace(/\D/g, "") : "";
  const waLink = waNumber
    ? `https://wa.me/55${waNumber}?text=${encodeURIComponent(
        `Oi! Vi seu anúncio "${item.title}" no #bazardazimba e quero saber mais.`,
      )}`
    : null;

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      <main className="zb-container pb-16">
        <nav
          aria-label="Caminho"
          className="pt-6 pb-4 font-sans text-fs-12 uppercase tracking-[0.16em] text-ink-500"
        >
          <Link href="/" className="hover:text-navy">
            Início
          </Link>
          <span className="px-2 text-ink-300">/</span>
          <Link href="/bazardazimba" className="hover:text-navy">
            #bazardazimba
          </Link>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
          <div className="relative aspect-square bg-white border border-border-subtle overflow-hidden">
            {item.photo_url ? (
              <Image
                src={item.photo_url}
                alt={item.title}
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display italic font-normal text-navy/15 text-[180px] leading-none select-none">
                  {item.title[0]}
                </span>
              </div>
            )}
            <span
              className={`absolute top-4 left-4 text-[10px] uppercase tracking-[0.28em] font-bold px-3 py-1.5 ${typeStyles[item.type]}`}
            >
              {item.type}
            </span>
            {item.category && (
              <span className="absolute bottom-4 right-4 text-[10px] uppercase tracking-[0.18em] font-semibold bg-white/90 text-navy/70 px-3 py-1 rounded-xs">
                {item.category}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] font-semibold text-navy/50 mb-3">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="map-pin" size={11} /> {item.bairro}
              </span>
              <span aria-hidden>·</span>
              <span>{item.postedAt}</span>
            </div>

            <h1 className="font-display font-black leading-[1.05] tracking-[-0.02em] text-navy text-fs-36 lg:text-fs-44 mb-4">
              {item.title}
            </h1>

            <p
              className={`font-display font-black tracking-[-0.02em] text-fs-44 lg:text-fs-56 mb-6 ${priceColor[item.type]}`}
            >
              {item.price}
            </p>

            {item.description && (
              <div className="border-t border-border-subtle pt-6 mb-7">
                <h2 className="text-[10px] uppercase tracking-[0.28em] font-bold text-ink-500 mb-3">
                  Descrição
                </h2>
                <p className="font-display text-fs-17 leading-[1.55] text-navy/85 whitespace-pre-line">
                  {item.description}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-eco-green text-off-white text-[12px] uppercase tracking-[0.24em] font-bold px-7 h-12 inline-flex items-center justify-center gap-2 hover:bg-navy transition-colors"
                >
                  <Icon name="whatsapp" size={14} /> Chamar no zap
                </a>
              ) : (
                <span className="bg-navy/10 text-navy/40 text-[12px] uppercase tracking-[0.24em] font-bold px-7 h-12 inline-flex items-center justify-center gap-2">
                  <Icon name="whatsapp" size={14} /> Sem contato
                </span>
              )}
              <Link
                href="/bazardazimba"
                className="border border-navy/20 text-navy text-[12px] uppercase tracking-[0.24em] font-bold px-7 h-12 inline-flex items-center justify-center hover:border-navy transition-colors"
              >
                Ver mais anúncios
              </Link>
            </div>

            <ScamWarning className="mt-6" />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
