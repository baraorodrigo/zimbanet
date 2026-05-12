import Link from "next/link";
import type { MuralPost } from "@/lib/mock-data";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ZimbaMilGrauWidget({ posts }: { posts: MuralPost[] }) {
  return (
    <section className="bg-navy text-off-white relative overflow-hidden my-16">
      {/* gold grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(0deg, rgba(232,177,0,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(232,177,0,0.6) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(ellipse at 70% 40%, #000 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 70% 40%, #000 30%, transparent 75%)",
        }}
      />
      <div className="relative px-10 md:px-16 py-16 grid grid-cols-1 lg:grid-cols-3 gap-14">
        {/* Heading */}
        <header className="lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="eyebrow eyebrow-light mb-5">
              <span>Comunidade</span>
            </div>
            <h2 className="font-display font-black text-[60px] md:text-[80px] leading-[0.92] tracking-[-0.04em]">
              <span className="block">#zimba</span>
              <span className="block text-zimba-gold italic font-normal">milgrau</span>
            </h2>
            <p className="mt-5 font-display italic font-normal text-off-white/70 text-[22px] leading-[1.3] max-w-sm">
              a voz do povo de Imbituba
            </p>

            {posts.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[11px] uppercase tracking-[0.24em] font-semibold text-off-white/55">
                <span>
                  <strong className="text-zimba-gold font-bold">{posts.length}</strong>{" "}
                  {posts.length === 1 ? "post recente" : "posts recentes"}
                </span>
              </div>
            )}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-3">
            <Link
              href="/zimbamilgrau"
              className="bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 inline-flex items-center justify-center hover:bg-off-white transition-colors"
            >
              Postar agora
            </Link>
            <Link
              href="/zimbamilgrau"
              className="border border-off-white/25 hover:border-zimba-gold text-off-white hover:text-zimba-gold text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 inline-flex items-center justify-center transition-colors"
            >
              Ver mural →
            </Link>
          </div>
        </header>

        {/* Feed */}
        {posts.length === 0 ? (
          <div className="lg:col-span-2 border border-dashed border-zimba-gold/30 bg-zimba-blue/20 px-8 py-16 text-center">
            <p className="font-display italic text-[24px] text-off-white/80 leading-tight">
              o mural tá quietinho.
            </p>
            <p className="mt-2 text-[13px] text-off-white/55">
              seja o primeiro a soltar uma da sua quebrada.
            </p>
            <Link
              href="/zimbamilgrau"
              className="mt-6 inline-flex items-center justify-center bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 hover:bg-off-white transition-colors"
            >
              Postar agora
            </Link>
          </div>
        ) : (
        <div className="lg:col-span-2 zb-mural-viewport relative h-[420px] md:h-[480px] overflow-hidden">
          <ul className={`${posts.length >= 6 ? "zb-mural-track" : ""} space-y-4 will-change-transform`}>
            {(posts.length >= 6 ? [...posts, ...posts] : posts).map((p, i) => (
            <li
              key={`${p.id}-${i}`}
              className="bg-zimba-blue/40 border-l-2 border-zimba-gold/50 hover:border-zimba-gold p-6 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-zimba-gold text-navy font-display font-black text-[15px] flex items-center justify-center shrink-0 tracking-[-0.02em]">
                  {p.isAnon ? "?" : initials(p.author)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mb-1.5">
                    <span className="font-display font-bold text-off-white tracking-[-0.005em]">
                      {p.isAnon ? "Anônimo" : p.author}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-zimba-gold/75">
                      {p.bairro}
                    </span>
                    <span className="text-[10px] tracking-[0.18em] uppercase text-off-white/35 font-semibold ml-auto">
                      {p.postedAt}
                    </span>
                  </div>
                  <p className="text-[15px] leading-[1.55] text-off-white/90 font-light">
                    {p.body}
                  </p>
                  <div className="mt-4 flex items-center gap-6 text-[12px] text-off-white/50">
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10z" />
                      </svg>
                      {p.likes}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                      {p.comments}
                    </span>
                  </div>
                </div>
              </div>
            </li>
            ))}
          </ul>
        </div>
        )}
      </div>
    </section>
  );
}
