import type { ReactNode } from "react";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

type Props = {
  kicker: string;
  title: string;
  intro?: string;
  updatedAt?: string;
  children: ReactNode;
};

export default function InstitutionalShell({
  kicker,
  title,
  intro,
  updatedAt,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />
      <main className="zb-container pb-16">
        <nav
          aria-label="Caminho"
          className="pt-6 pb-3 font-sans text-fs-12 uppercase tracking-[0.16em] text-ink-500"
        >
          <Link href="/" className="hover:text-navy">Início</Link>
          <span className="px-2 text-ink-300">/</span>
          <span className="text-navy">{kicker}</span>
        </nav>

        <header className="border-b border-border-subtle pb-7 mb-8">
          <div className="flex items-baseline gap-3">
            <span className="h-[3px] w-10 bg-zimba-gold" aria-hidden />
            <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-zimba-gold">
              {kicker}
            </p>
          </div>
          <h1 className="mt-3 font-display text-fs-44 lg:text-fs-56 font-black leading-tight tracking-tight2 text-navy">
            {title}
          </h1>
          {intro && (
            <p className="mt-4 max-w-[60ch] text-fs-18 leading-relaxed text-ink-700">
              {intro}
            </p>
          )}
          {updatedAt && (
            <p className="mt-4 text-fs-12 uppercase tracking-[0.18em] text-ink-500 font-semibold">
              Atualizado em {updatedAt}
            </p>
          )}
        </header>

        <article className="prose-zb max-w-[68ch] font-display text-fs-17 leading-[1.75] text-navy">
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
