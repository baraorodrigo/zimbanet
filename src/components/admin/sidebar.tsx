"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = {
  href: string;
  label: string;
  hint?: string;
  match?: (path: string) => boolean;
};

const NAV: Item[] = [
  { href: "/admin", label: "Dashboard", hint: "Visão geral", match: (p) => p === "/admin" },
  { href: "/admin/pauta", label: "Pauta", hint: "Sugestões do Curador" },
  { href: "/admin/fila", label: "Fila", hint: "Aguardando publicação" },
  { href: "/admin/social", label: "Social", hint: "Pacotes pra IG / FB / WhatsApp" },
  { href: "/admin/materias", label: "Matérias", hint: "Tudo o que já entrou" },
  { href: "/admin/materias/nova", label: "Nova matéria", hint: "Criar do zero" },
  { href: "/admin/ticker", label: "Ticker", hint: "Barra vermelha do portal" },
  { href: "/admin/moderacao", label: "Moderação", hint: "Mural / Bazar guest" },
  { href: "/admin/personas", label: "Personas", hint: "Vozes da redação" },
  { href: "/admin/curador", label: "Curador", hint: "O que o Haiku procura" },
  { href: "/admin/fontes", label: "Fontes", hint: "RSS / scrapers" },
  { href: "/admin/autonomo", label: "Autônomo", hint: "Scheduler do motor" },
  { href: "/admin/auditoria", label: "Auditoria", hint: "Histórico" },
  { href: "/admin/configuracoes", label: "Configurações", hint: "Modelos & chaves de IA" },
];

// Em mobile vira drawer: barra fina com hamburger fixa no topo, sidebar
// desliza pela esquerda com backdrop. Em lg+ volta a ser coluna fixa de 260px.
export default function AdminSidebar({ email }: { email: string | null }) {
  const pathname = usePathname() || "/admin";
  const [open, setOpen] = useState(false);

  // Fecha o drawer ao navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trava o scroll do body quando o drawer abre em mobile
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      {/* Top bar mobile — hamburger + brand resumida. lg:hidden */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-12 bg-navy text-off-white border-b border-navy/40 flex items-center px-3 gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
        >
          <span aria-hidden className="block w-5 space-y-1">
            <span className="block h-[2px] bg-off-white" />
            <span className="block h-[2px] bg-off-white" />
            <span className="block h-[2px] bg-off-white" />
          </span>
        </button>
        <Link href="/admin" className="font-display font-black text-fs-15 leading-none">
          ZIMBA<span className="text-zimba-gold">NET</span>
          <span className="ml-2 text-[9px] uppercase tracking-[0.22em] font-bold text-zimba-gold/80">
            Painel
          </span>
        </Link>
      </div>

      {/* Backdrop — mobile only, quando aberto */}
      {open && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm"
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        id="admin-sidebar"
        aria-label="Navegação do painel"
        className={`
          fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col
          bg-navy text-off-white border-r border-navy/40
          transform transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:w-auto lg:min-h-screen lg:z-auto
        `}
      >
        {/* Brand + close (mobile only) */}
        <div className="px-5 py-5 border-b border-white/10 flex items-start justify-between gap-3">
          <div>
            <Link href="/" className="block leading-none">
              <span className="font-display font-black text-[22px] text-off-white">
                ZIMBA<span className="text-zimba-gold">NET</span>
              </span>
            </Link>
            <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-zimba-gold/90 font-bold">
              Painel editorial
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden h-8 w-8 inline-flex items-center justify-center rounded-md text-off-white/80 hover:bg-white/10 hover:text-off-white transition-colors text-fs-14"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = item.match
              ? item.match(pathname)
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group block rounded-md px-3 py-2.5 transition-colors ${
                  active
                    ? "bg-zimba-gold text-navy"
                    : "text-off-white/85 hover:bg-white/5 hover:text-off-white"
                }`}
              >
                <span
                  className={`block font-display font-bold text-fs-15 leading-tight ${
                    active ? "text-navy" : "text-off-white"
                  }`}
                >
                  {item.label}
                </span>
                {item.hint && (
                  <span
                    className={`block text-[11px] tracking-wide2 leading-tight mt-0.5 ${
                      active ? "text-navy/70" : "text-off-white/50 group-hover:text-off-white/70"
                    }`}
                  >
                    {item.hint}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 text-fs-12 text-off-white/70">
          <p className="font-mono truncate">{email ?? "anônimo"}</p>
          <Link
            href="/"
            className="mt-2 inline-block text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold hover:text-off-white"
          >
            ← Voltar ao portal
          </Link>
        </div>
      </aside>
    </>
  );
}
