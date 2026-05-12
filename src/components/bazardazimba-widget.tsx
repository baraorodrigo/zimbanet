import Link from "next/link";
import type { BazarItem } from "@/lib/mock-data";

const filters = ["Tudo", "Vende", "Doa", "Troca", "Procura"];

const typeStyles: Record<BazarItem["type"], string> = {
  Vende: "bg-zimba-gold text-navy",
  Doa: "bg-eco-green text-off-white",
  Troca: "bg-zimba-blue text-off-white",
  Procura: "bg-alert-red text-off-white",
};

export default function BazarDaZimbaWidget({ items }: { items: BazarItem[] }) {
  return (
    <section className="my-16">
      <header className="mb-10">
        <div className="rule-notched mb-7" />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="eyebrow mb-4">
              <span>Comunidade</span>
            </div>
            <h2 className="font-display font-black text-[44px] md:text-[60px] leading-[0.95] tracking-[-0.04em] text-navy">
              <span>#bazar</span>
              <span className="text-zimba-gold italic font-normal">dazimba</span>
            </h2>
            <p className="mt-3 font-display italic font-normal text-zimba-blue text-[20px] leading-[1.3]">
              vende, doa, troca — entre vizinhos
            </p>
            {items.length > 0 && (
              <p className="mt-4 text-[13px] tracking-[0.04em] text-navy/60">
                <strong className="text-navy font-display font-bold">{items.length}</strong>{" "}
                {items.length === 1 ? "anúncio ativo" : "anúncios ativos"}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filters.map((f, i) => (
              <Link
                key={f}
                href={f === "Tudo" ? "/bazardazimba" : `/bazardazimba?type=${f}`}
                className={`text-[10px] uppercase tracking-[0.22em] font-bold px-3.5 h-9 border inline-flex items-center transition-colors ${
                  i === 0
                    ? "border-navy bg-navy text-off-white hover:bg-zimba-blue hover:border-zimba-blue"
                    : "border-navy/15 text-navy hover:border-navy hover:bg-navy hover:text-off-white"
                }`}
              >
                {f}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="border border-dashed border-navy/20 bg-white px-8 py-16 text-center">
          <p className="font-display italic text-[24px] text-navy/70 leading-tight">
            o bazar tá vazio.
          </p>
          <p className="mt-2 text-[13px] text-navy/55">
            anuncie de graça e converse direto pelo whatsapp.
          </p>
          <Link
            href="/bazardazimba/novo"
            className="mt-6 inline-flex items-center justify-center bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 hover:bg-navy hover:text-off-white transition-colors"
          >
            Anunciar grátis
          </Link>
        </div>
      ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {items.map((it) => (
          <article
            key={it.id}
            className="group bg-white border border-border-subtle hover:border-navy transition-colors"
          >
            <div className="relative aspect-square bg-navy/5 flex items-center justify-center overflow-hidden">
              <span className="font-display italic font-normal text-navy/15 text-[80px] leading-none">
                {it.title[0]}
              </span>
              <span
                className={`absolute top-2.5 left-2.5 text-[9px] uppercase tracking-[0.24em] font-bold px-2 py-1 ${typeStyles[it.type]}`}
              >
                {it.type}
              </span>
            </div>
            <div className="p-4">
              <p className="font-display font-bold text-[15px] leading-[1.18] tracking-[-0.005em] text-navy line-clamp-2 mb-2 min-h-[36px]">
                {it.title}
              </p>
              <p
                className={`font-display font-black text-[19px] tracking-[-0.015em] mb-1 ${
                  it.type === "Doa"
                    ? "text-eco-green"
                    : it.type === "Troca"
                      ? "text-zimba-blue"
                      : "text-navy"
                }`}
              >
                {it.price}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-navy/50 flex justify-between">
                <span>{it.bairro}</span>
                <span>{it.postedAt}</span>
              </p>
            </div>
          </article>
        ))}
      </div>
      )}

      <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <p className="text-[14px] text-navy/65 font-light">
          Anuncie grátis e converse direto pelo WhatsApp.
        </p>
        <div className="flex gap-3">
          <Link
            href="/bazardazimba/novo"
            className="bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 inline-flex items-center hover:bg-navy hover:text-off-white transition-colors"
          >
            Anunciar grátis
          </Link>
          <Link
            href="/bazardazimba"
            className="border border-navy text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 inline-flex items-center hover:bg-navy hover:text-off-white transition-colors"
          >
            Ver todos →
          </Link>
        </div>
      </div>
    </section>
  );
}
