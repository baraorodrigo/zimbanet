import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import Icon from "@/components/icon";
import { type BazarItem } from "@/lib/mock-data";
import { getBazarItemsWithFallback } from "@/lib/db/community";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "#bazardazimba — Vende, doa, troca em Imbituba · ZIMBANET",
  description:
    "Classificados gratuitos entre vizinhos. Anuncie e converse direto pelo WhatsApp. Sem taxas, sem intermediário.",
};

const filters = ["Tudo", "Vende", "Doa", "Troca", "Procura"] as const;
type FilterLabel = (typeof filters)[number];

const categorias = [
  "Móveis",
  "Eletrônicos",
  "Eletrodomésticos",
  "Pets",
  "Esporte",
  "Vestuário",
  "Imóveis",
  "Serviços",
  "Alimentação",
];

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

function buildHref(params: { type?: string; cat?: string; q?: string }): string {
  const sp = new URLSearchParams();
  if (params.type && params.type !== "Tudo") sp.set("type", params.type);
  if (params.cat) sp.set("cat", params.cat);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/bazardazimba?${qs}` : "/bazardazimba";
}

export default async function BazarDaZimbaPage({
  searchParams,
}: {
  searchParams: { type?: string; cat?: string; q?: string };
}) {
  const { items: source, source: dataSource } = await getBazarItemsWithFallback(60);
  const baseItems =
    dataSource === "supabase" ? source : [...source, ...source, ...source].slice(0, 36);

  const activeType = (filters as readonly string[]).includes(searchParams.type ?? "")
    ? (searchParams.type as FilterLabel)
    : "Tudo";
  const activeCat = searchParams.cat ?? null;
  const query = (searchParams.q ?? "").trim().toLowerCase();

  const items = baseItems.filter((it) => {
    if (activeType !== "Tudo" && it.type !== activeType) return false;
    if (activeCat && it.category !== activeCat) return false;
    if (query) {
      const hay = `${it.title} ${it.description ?? ""}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const total = source.length;
  const counts = filters.reduce<Record<string, number>>((acc, f) => {
    if (f === "Tudo") acc[f] = total;
    else acc[f] = source.filter((i) => i.type === f).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      <main className="zb-container pb-20">
        <header className="pt-10 pb-8">
          <div className="rule-notched mb-7" />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
            <div>
              <div className="eyebrow mb-4">
                <span>Comunidade</span>
              </div>
              <h1 className="font-display font-black leading-[0.95] tracking-[-0.04em] text-navy text-[56px] md:text-[80px] lg:text-[100px]">
                <span>#bazar</span>
                <span className="text-zimba-gold italic font-normal">
                  dazimba
                </span>
              </h1>
              <p className="mt-4 font-display italic text-zimba-blue text-[20px] md:text-[24px] leading-[1.3]">
                Vende, doa, troca — entre vizinhos, sem taxa e sem
                atravessador.
              </p>
              <p className="mt-3 text-fs-14 text-navy/65">
                <strong className="text-navy font-display font-bold">
                  {total} anúncios ativos
                </strong>{" "}
                · novos a cada hora · só Imbituba e região
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
              <Link
                href="/bazardazimba/novo"
                className="bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 inline-flex items-center justify-center hover:bg-navy hover:text-zimba-gold transition-colors"
              >
                Anunciar grátis
              </Link>
              <a
                href="https://wa.me/5548999999999"
                className="border border-navy text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 inline-flex items-center justify-center gap-2 hover:bg-navy hover:text-off-white transition-colors"
              >
                <Icon name="whatsapp" size={14} /> Tirar dúvida
              </a>
            </div>
          </div>
        </header>

        <div className="sticky top-[72px] z-30 -mx-6 px-6 lg:-mx-0 lg:px-0 mb-8 bg-off-white/95 backdrop-blur supports-[backdrop-filter]:bg-off-white/80 border-y border-border-subtle py-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => {
                const isActive = activeType === f;
                return (
                  <Link
                    key={f}
                    href={buildHref({ type: f, cat: activeCat ?? undefined, q: query || undefined })}
                    className={`text-[11px] uppercase tracking-[0.22em] font-bold px-4 h-10 border transition-colors inline-flex items-center gap-2 ${
                      isActive
                        ? "border-navy bg-navy text-off-white"
                        : "border-navy/15 text-navy hover:border-navy hover:bg-navy hover:text-off-white"
                    }`}
                  >
                    <span>{f}</span>
                    <span
                      className={`text-[9px] tabular-nums px-1.5 rounded-xs ${
                        isActive
                          ? "bg-zimba-gold text-navy"
                          : "bg-navy/8 text-navy/70"
                      }`}
                    >
                      {counts[f]}
                    </span>
                  </Link>
                );
              })}
            </div>

            <form
              method="get"
              action="/bazardazimba"
              className="flex items-center gap-2 border border-border-subtle bg-white rounded-md px-3 h-10 w-full lg:w-72 focus-within:border-zimba-gold"
              role="search"
            >
              {activeType !== "Tudo" && (
                <input type="hidden" name="type" value={activeType} />
              )}
              {activeCat && <input type="hidden" name="cat" value={activeCat} />}
              <Icon name="search" size={14} stroke={2} />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="O que você procura?"
                className="bg-transparent outline-none flex-1 text-fs-14 text-navy placeholder:text-ink-400"
              />
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 lg:gap-10">
          <aside className="min-w-0">
            <div className="zb-side-card">
              <h3 className="zb-side-card-title">Categorias</h3>
              <ul className="space-y-1.5">
                <li>
                  <Link
                    href={buildHref({ type: activeType, q: query || undefined })}
                    className={`flex items-center justify-between text-fs-13 py-1 ${
                      !activeCat
                        ? "text-zimba-blue font-bold"
                        : "text-navy/80 hover:text-zimba-blue"
                    }`}
                  >
                    <span>Todas</span>
                  </Link>
                </li>
                {categorias.map((c) => {
                  const count = source.filter((i) => i.category === c).length;
                  const isActive = activeCat === c;
                  return (
                    <li key={c}>
                      <Link
                        href={buildHref({ type: activeType, cat: c, q: query || undefined })}
                        className={`flex items-center justify-between text-fs-13 py-1 ${
                          isActive
                            ? "text-zimba-blue font-bold"
                            : "text-navy/80 hover:text-zimba-blue"
                        }`}
                      >
                        <span>{c}</span>
                        <span className="text-[10px] tabular-nums text-ink-400 font-semibold">
                          {count}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="zb-side-card mt-6">
              <h3 className="zb-side-card-title">Como funciona</h3>
              <ol className="space-y-3 text-fs-13 text-ink-700 leading-relaxed">
                <li className="flex gap-2">
                  <span className="font-display font-black text-zimba-gold">1.</span>
                  Anuncie em 30s — só foto, preço e WhatsApp.
                </li>
                <li className="flex gap-2">
                  <span className="font-display font-black text-zimba-gold">2.</span>
                  Comprador chama direto no seu zap.
                </li>
                <li className="flex gap-2">
                  <span className="font-display font-black text-zimba-gold">3.</span>
                  Combinem entrega ou ponto de encontro.
                </li>
                <li className="flex gap-2">
                  <span className="font-display font-black text-zimba-gold">4.</span>
                  Marca como vendido e ajuda outro vizinho.
                </li>
              </ol>
            </div>

            <div className="rounded-md bg-eco-green text-off-white p-5 mt-6">
              <div className="text-[10px] uppercase tracking-[0.28em] font-bold mb-2 opacity-80">
                Aviso da redação
              </div>
              <p className="font-display text-fs-16 leading-snug">
                Bazar gratuito é um serviço comunitário. ZIMBANET não cobra,
                não intermedia, não garante negociação.
              </p>
            </div>
          </aside>

          <div className="min-w-0">
            {items.length === 0 ? (
              <div className="border border-border-subtle bg-white p-10 text-center">
                <p className="font-display text-fs-20 text-navy/70 mb-2">
                  Nada encontrado pra esse filtro.
                </p>
                <p className="text-fs-13 text-ink-500 mb-5">
                  Tenta limpar o filtro ou procurar outro termo.
                </p>
                <Link
                  href="/bazardazimba"
                  className="inline-flex border border-navy text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-10 items-center hover:bg-navy hover:text-off-white transition-colors"
                >
                  Limpar filtros
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((it, i) => {
                  const waNumber = it.whatsapp ? it.whatsapp.replace(/\D/g, "") : "";
                  const waLink = waNumber
                    ? `https://wa.me/55${waNumber}?text=${encodeURIComponent(
                        `Oi! Vi seu anúncio "${it.title}" no #bazardazimba.`,
                      )}`
                    : null;
                  return (
                    <article
                      key={`${it.id}-${i}`}
                      className="group bg-white border border-border-subtle hover:border-navy hover:shadow-z-2 transition-all flex flex-col"
                    >
                      <Link href={`/bazardazimba/${it.id}`} className="block">
                        <div className="relative aspect-square bg-navy/5 flex items-center justify-center overflow-hidden">
                          <span className="font-display italic font-normal text-navy/15 text-[88px] leading-none select-none">
                            {it.title[0]}
                          </span>
                          <span
                            className={`absolute top-2.5 left-2.5 text-[9px] uppercase tracking-[0.24em] font-bold px-2 py-1 ${typeStyles[it.type]}`}
                          >
                            {it.type}
                          </span>
                          {it.category && (
                            <span className="absolute bottom-2.5 right-2.5 text-[9px] uppercase tracking-[0.18em] font-semibold bg-white/90 text-navy/70 px-2 py-0.5 rounded-xs">
                              {it.category}
                            </span>
                          )}
                        </div>
                      </Link>
                      <div className="p-4 flex flex-col flex-1">
                        <Link href={`/bazardazimba/${it.id}`} className="block">
                          <p className="font-display font-bold text-fs-15 leading-[1.18] tracking-[-0.005em] text-navy line-clamp-2 mb-2 min-h-[36px] hover:text-zimba-blue transition-colors">
                            {it.title}
                          </p>
                        </Link>
                        <p
                          className={`font-display font-black text-fs-19 tracking-[-0.015em] mb-2 ${priceColor[it.type]}`}
                        >
                          {it.price}
                        </p>
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.18em] font-semibold text-navy/50 mb-3">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="map-pin" size={10} /> {it.bairro}
                          </span>
                          <span>{it.postedAt}</span>
                        </div>
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto w-full inline-flex items-center justify-center gap-1.5 border border-eco-green/40 text-eco-green hover:bg-eco-green hover:text-off-white text-[10px] uppercase tracking-[0.22em] font-bold h-9 transition-colors"
                          >
                            <Icon name="whatsapp" size={12} /> Chamar no zap
                          </a>
                        ) : (
                          <Link
                            href={`/bazardazimba/${it.id}`}
                            className="mt-auto w-full inline-flex items-center justify-center gap-1.5 border border-navy/20 text-navy hover:bg-navy hover:text-off-white text-[10px] uppercase tracking-[0.22em] font-bold h-9 transition-colors"
                          >
                            Ver detalhes
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
