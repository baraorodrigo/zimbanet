import Link from "next/link";
import Icon from "./icon";
import UserMenu from "./user-menu";
import MobileMenu from "./mobile-menu";
import AuthModal from "./auth-modal";
import OpenLoginButton from "./open-login-button";
import { createClient } from "@/lib/supabase/server";
import { getWeather } from "@/lib/weather";

const editorias = [
  { label: "Início", href: "/" },
  { label: "Cidade", href: "/cidade" },
  { label: "Política", href: "/politica" },
  { label: "Esporte", href: "/esporte" },
  { label: "Cultura", href: "/cultura" },
  { label: "Polícia", href: "/policia" },
  { label: "Praias", href: "/praias" },
];

const tags = [
  { label: "#zimbamilgrau", href: "/zimbamilgrau" },
  { label: "#bazardazimba", href: "/bazardazimba" },
];

function todayPtBr() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function initialsFrom(name: string | undefined | null, email: string | undefined | null) {
  const src = (name && name.trim()) || (email ? email.split("@")[0] : "") || "ZN";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default async function SiteHeader() {
  const supabase = createClient();
  const [
    {
      data: { user },
    },
    weather,
  ] = await Promise.all([supabase.auth.getUser(), getWeather()]);
  const isLogged = !!user;
  const email = user?.email ?? null;
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? null;
  const initials = initialsFrom(fullName, email ?? user?.phone ?? null);

  return (
    <header>
      {/* Masthead — thin deep-navy strip: data · localização · tempo · social · login */}
      <div className="bg-navy text-off-white border-b border-white/8">
        <div className="zb-container h-9 flex items-center justify-between text-fs-12">
          <div className="flex items-center gap-3 capitalize text-off-white/85">
            <span className="font-medium">{todayPtBr()}</span>
            <span className="text-off-white/30">·</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="map-pin" size={12} /> Imbituba, SC
            </span>
            <span className="text-off-white/30">·</span>
            <span
              className="inline-flex items-center gap-1 text-zimba-gold font-semibold tracking-wide2"
              title={`${weather.cidade} · ${weather.condicao}`}
            >
              <Icon name="sun" size={12} /> {weather.tempC}°C
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3.5 text-off-white/75">
            <a
              href="https://instagram.com/bombei_imbituba"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zimba-gold transition-colors"
              aria-label="Instagram @bombei_imbituba"
            >
              <Icon name="instagram" size={14} />
            </a>
            <a
              href="https://facebook.com/bombei.imbituba"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zimba-gold transition-colors"
              aria-label="Facebook @bombei.imbituba"
            >
              <Icon name="facebook" size={14} />
            </a>
            <span className="text-white/20">|</span>
            <Link href="/anuncie" className="font-semibold hover:text-zimba-gold transition-colors">Anuncie</Link>
            {isLogged ? (
              <UserMenu email={email} initials={initials} />
            ) : (
              <OpenLoginButton className="font-semibold hover:text-zimba-gold transition-colors">
                Login
              </OpenLoginButton>
            )}
          </div>
        </div>
      </div>

      {/* Navbar — sticky deep-navy bar with logo + nav + busca, gold underline */}
      <div className="sticky top-0 z-40 bg-navy text-off-white border-b-[3px] border-zimba-gold">
        <div className="zb-container h-16 flex items-center gap-6">
          <Link href="/" className="flex items-center shrink-0" aria-label="Zimbanet — Imbituba conectada">
            <span className="font-display font-black text-[28px] tracking-tight2 leading-none">
              ZIMBA<span className="text-zimba-gold">NET</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-[22px] flex-1">
            {editorias.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="text-fs-14 font-semibold text-off-white/85 hover:text-zimba-gold tracking-[0.01em] transition-colors"
              >
                {e.label}
              </Link>
            ))}
            <span className="w-px h-4 bg-white/15" />
            {tags.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="text-fs-13 font-bold uppercase tracking-tag text-zimba-gold/90 hover:text-zimba-gold transition-colors"
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <form
            action="/buscar"
            method="get"
            className="ml-auto hidden md:flex items-center gap-2 bg-white/8 border border-white/15 rounded-sm px-3 h-9 min-w-[240px] focus-within:bg-white/14 focus-within:border-zimba-gold transition-colors"
            role="search"
          >
            <Icon name="search" size={14} className="text-off-white/70" />
            <input
              name="q"
              type="search"
              placeholder="Buscar em Imbituba…"
              aria-label="Buscar matérias"
              className="bg-transparent outline-none flex-1 text-fs-13 text-white placeholder:text-off-white/55"
            />
          </form>

          {/* Mobile: atalho de lupa direto pra /buscar (no md+ a barra acima já existe). */}
          <Link
            href="/buscar"
            aria-label="Buscar"
            className="ml-auto md:hidden inline-flex items-center justify-center h-9 w-9 rounded-sm bg-white/8 border border-white/15 text-off-white/85 hover:bg-white/14 hover:border-zimba-gold hover:text-zimba-gold transition-colors"
          >
            <Icon name="search" size={16} />
          </Link>

          <MobileMenu isLogged={isLogged} />
        </div>
      </div>

      {/* Modal de login público — só renderiza quando ?login=1 na URL.
          Triggered por botões "Postar"/"Anunciar" via openLoginHref(). */}
      <AuthModal />
    </header>
  );
}
