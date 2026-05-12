import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import Icon from "@/components/icon";
import { signOut } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth/user";
import { isStaff } from "@/lib/auth/admin";
import {
  fetchMyBazarItems,
  fetchMyMuralPosts,
} from "@/lib/db/my-account";
import BazarRow from "./bazar-row";
import MuralRow from "./mural-row";

export const dynamic = "force-dynamic";

type Tab = "bazar" | "mural";

export default async function MinhaContaPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { user } = await requireUser({ next: "/minha-conta" });
  const tab: Tab = searchParams.tab === "mural" ? "mural" : "bazar";

  const [bazarItems, muralPosts] = await Promise.all([
    fetchMyBazarItems(user.id),
    fetchMyMuralPosts(user.id),
  ]);

  const activeBazar = bazarItems.filter((i) => i.status === "active").length;
  const soldBazar = bazarItems.filter((i) => i.status === "sold").length;
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? null;
  const displayName =
    fullName || user.email?.split("@")[0] || user.phone || "Vizinho";

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      <main className="zb-container pb-20">
        <header className="pt-10 pb-8">
          <div className="rule-notched mb-7" />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-end">
            <div>
              <div className="eyebrow mb-4">
                <span>Minha conta</span>
              </div>
              <h1 className="font-display font-black leading-[0.95] tracking-[-0.04em] text-navy text-[44px] md:text-[64px]">
                Olá,{" "}
                <span className="text-zimba-gold italic font-normal">
                  {displayName}
                </span>
              </h1>
              <p className="mt-4 text-fs-14 text-navy/65">
                {user.email ?? user.phone}
                {isStaff(user) && (
                  <>
                    {" · "}
                    <Link
                      href="/admin"
                      className="text-zimba-blue font-semibold hover:underline"
                    >
                      acessar painel da redação
                    </Link>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
              <Link
                href="/bazardazimba/novo"
                className="bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 inline-flex items-center justify-center hover:bg-navy hover:text-zimba-gold transition-colors"
              >
                Anunciar no bazar
              </Link>
              <Link
                href="/zimbamilgrau"
                className="border border-navy text-navy text-[11px] uppercase tracking-[0.28em] font-bold px-7 h-12 inline-flex items-center justify-center hover:bg-navy hover:text-off-white transition-colors"
              >
                Postar no mural
              </Link>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          <StatCard label="Anúncios ativos" value={activeBazar} accent="eco-green" />
          <StatCard label="Vendidos" value={soldBazar} accent="navy" />
          <StatCard label="Posts no mural" value={muralPosts.length} accent="zimba-gold" />
        </div>

        <nav className="flex gap-2 border-b border-border-subtle mb-6" aria-label="Seções">
          <TabLink
            href="/minha-conta?tab=bazar"
            label="Bazar"
            count={bazarItems.length}
            active={tab === "bazar"}
          />
          <TabLink
            href="/minha-conta?tab=mural"
            label="Mural"
            count={muralPosts.length}
            active={tab === "mural"}
          />
        </nav>

        {tab === "bazar" ? (
          bazarItems.length === 0 ? (
            <EmptyState
              title="Você ainda não tem anúncios."
              hint="Bazar é grátis e leva uns 30s — foto, preço e WhatsApp."
              ctaHref="/bazardazimba/novo"
              ctaLabel="Anunciar grátis"
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {bazarItems.map((it) => (
                <BazarRow key={it.id} item={it} />
              ))}
            </div>
          )
        ) : muralPosts.length === 0 ? (
          <EmptyState
            title="Nada postado no mural ainda."
            hint="Conta o que tá rolando no seu bairro — boa, ruim, curiosa, doida."
            ctaHref="/zimbamilgrau"
            ctaLabel="Postar agora"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {muralPosts.map((p) => (
              <MuralRow key={p.id} post={p} />
            ))}
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-border-subtle flex items-center justify-between">
          <p className="text-fs-13 text-navy/60">
            Quer sair desta conta?
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="text-[10px] uppercase tracking-[0.22em] font-bold px-4 h-10 border border-navy/30 text-navy hover:bg-navy hover:text-off-white transition-colors inline-flex items-center gap-2"
            >
              <Icon name="x" size={12} /> Sair
            </button>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "eco-green" | "navy" | "zimba-gold";
}) {
  const accentClass = {
    "eco-green": "text-eco-green",
    navy: "text-navy",
    "zimba-gold": "text-zimba-gold",
  }[accent];
  return (
    <div className="border border-border-subtle bg-white p-4 sm:p-5">
      <p className="text-[9px] uppercase tracking-[0.22em] font-bold text-navy/55 mb-1">
        {label}
      </p>
      <p className={`font-display font-black text-[32px] sm:text-[40px] leading-none ${accentClass}`}>
        {value}
      </p>
    </div>
  );
}

function TabLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative px-1 pb-3 text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center gap-2 transition-colors ${
        active ? "text-navy" : "text-navy/50 hover:text-navy"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[9px] tabular-nums px-1.5 rounded-xs ${
          active ? "bg-zimba-gold text-navy" : "bg-navy/8 text-navy/70"
        }`}
      >
        {count}
      </span>
      {active && (
        <span className="absolute left-0 right-0 -bottom-px h-[3px] bg-zimba-gold" />
      )}
    </Link>
  );
}

function EmptyState({
  title,
  hint,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  hint: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="border border-border-subtle bg-white p-10 text-center">
      <p className="font-display text-fs-20 text-navy/80 mb-2">{title}</p>
      <p className="text-fs-13 text-ink-500 mb-5">{hint}</p>
      <Link
        href={ctaHref}
        className="inline-flex bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-10 items-center hover:bg-navy hover:text-zimba-gold transition-colors"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
