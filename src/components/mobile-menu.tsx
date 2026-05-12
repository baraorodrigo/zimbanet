"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./icon";
import OpenLoginButton from "./open-login-button";

const editorias = [
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

const inst = [
  { label: "Buscar", href: "/buscar" },
  { label: "Newsletter", href: "/newsletter" },
  { label: "Enviar pauta", href: "/pauta" },
  { label: "Anuncie", href: "/anuncie" },
  { label: "Sobre", href: "/sobre" },
];

type Props = {
  isLogged: boolean;
};

export default function MobileMenu({ isLogged }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-sm hover:bg-white/10 text-off-white"
        aria-label="Abrir menu"
        aria-expanded={open}
        aria-controls="zimbanet-mobile-menu"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={20} />
      </button>

      {open && (
        <div
          id="zimbanet-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
          className="lg:hidden fixed inset-0 z-50 bg-navy text-off-white overflow-y-auto"
        >
          <div className="zb-container py-5">
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="font-display font-black text-[28px] tracking-tight2 leading-none"
                aria-label="Zimbanet — capa"
              >
                ZIMBA<span className="text-zimba-gold">NET</span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                type="button"
                className="inline-flex items-center justify-center w-10 h-10 rounded-sm hover:bg-white/10"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <form
              action="/buscar"
              method="get"
              role="search"
              onSubmit={() => setOpen(false)}
              className="flex items-center gap-2 bg-white/8 border border-white/15 rounded-sm px-3 h-11 mb-8 focus-within:border-zimba-gold transition-colors"
            >
              <Icon name="search" size={16} className="text-off-white/70" />
              <input
                name="q"
                type="search"
                placeholder="Buscar em Imbituba…"
                aria-label="Buscar matérias"
                className="bg-transparent outline-none flex-1 text-fs-14 text-white placeholder:text-off-white/55"
              />
            </form>

            <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
              Editorias
            </p>
            <nav className="grid grid-cols-2 gap-2 mb-8">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="rounded-sm bg-white/8 border border-white/10 px-4 py-3 font-display font-bold text-fs-15 hover:bg-zimba-gold hover:text-navy hover:border-zimba-gold transition-colors"
              >
                Capa
              </Link>
              {editorias.map((e) => (
                <Link
                  key={e.href}
                  href={e.href}
                  onClick={() => setOpen(false)}
                  className="rounded-sm bg-white/8 border border-white/10 px-4 py-3 font-display font-bold text-fs-15 hover:bg-zimba-gold hover:text-navy hover:border-zimba-gold transition-colors"
                >
                  {e.label}
                </Link>
              ))}
            </nav>

            <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
              Comunidade
            </p>
            <nav className="space-y-2 mb-8">
              {tags.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 rounded-sm bg-white/5 border border-white/10 font-sans uppercase tracking-tag text-fs-13 font-bold text-zimba-gold hover:bg-zimba-gold hover:text-navy transition-colors"
                >
                  {t.label}
                </Link>
              ))}
            </nav>

            <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
              Mais
            </p>
            <nav className="grid grid-cols-2 gap-2 mb-10">
              {inst.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-sm font-sans text-fs-14 text-off-white/85 hover:text-zimba-gold transition-colors"
                >
                  {i.label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-white/10 pt-5">
              {isLogged ? (
                <Link
                  href="/minha-conta"
                  onClick={() => setOpen(false)}
                  className="block w-full text-center bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold px-5 py-3 rounded-sm hover:bg-off-white transition-colors"
                >
                  Minha conta
                </Link>
              ) : (
                <OpenLoginButton
                  onClick={() => setOpen(false)}
                  className="block w-full text-center bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold px-5 py-3 rounded-sm hover:bg-off-white transition-colors"
                >
                  Entrar
                </OpenLoginButton>
              )}
              <div className="mt-4 flex items-center justify-center gap-5 text-off-white/70">
                <a
                  href="https://instagram.com/bombei_imbituba"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram @bombei_imbituba"
                  className="hover:text-zimba-gold"
                >
                  <Icon name="instagram" size={20} />
                </a>
                <a
                  href="https://facebook.com/bombei.imbituba"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook @bombei.imbituba"
                  className="hover:text-zimba-gold"
                >
                  <Icon name="facebook" size={20} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
