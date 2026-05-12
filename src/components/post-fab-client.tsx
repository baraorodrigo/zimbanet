"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "./icon";
import { openLoginHref } from "@/lib/auth/login-url";

const HIDDEN_PATH_PREFIXES = ["/admin", "/login", "/minha-conta", "/auth"];
const HIDDEN_PATHS_EXACT = new Set(["/bazardazimba/novo"]);

type Props = { isLogged: boolean };

export default function PostFabClient({ isLogged }: Props) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const hidden =
    HIDDEN_PATH_PREFIXES.some((p) => pathname.startsWith(p)) ||
    HIDDEN_PATHS_EXACT.has(pathname);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Fecha o menu quando muda de rota.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (hidden) return null;

  function goOrLogin(target: string) {
    setOpen(false);
    if (isLogged) {
      router.push(target);
    } else {
      router.push(openLoginHref(pathname, search, target), { scroll: false });
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="fixed z-40 bottom-5 right-5 sm:bottom-7 sm:right-7"
    >
      {open && (
        <div
          role="menu"
          aria-label="Onde você quer postar?"
          className="absolute bottom-full right-0 mb-3 w-64 bg-white border border-navy/12 shadow-z-3 rounded-md overflow-hidden"
        >
          <div className="px-4 py-3 bg-navy text-off-white">
            <p className="text-[9px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
              Postar
            </p>
            <p className="font-display text-fs-15 mt-0.5">
              Onde quer publicar?
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => goOrLogin("/bazardazimba/novo")}
            className="w-full text-left px-4 py-3 hover:bg-zimba-gold/10 transition-colors border-b border-border-subtle"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 bg-zimba-gold/15 text-zimba-gold flex items-center justify-center rounded-sm">
                <Icon name="bookmark" size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-fs-14 text-navy">
                  Anunciar no bazar
                </p>
                <p className="text-fs-12 text-navy/60">
                  Vende, doa, troca — grátis
                </p>
              </div>
            </div>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => goOrLogin("/zimbamilgrau")}
            className="w-full text-left px-4 py-3 hover:bg-zimba-blue/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 bg-zimba-blue/15 text-zimba-blue flex items-center justify-center rounded-sm">
                <Icon name="share" size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-fs-14 text-navy">
                  Postar no mural
                </p>
                <p className="text-fs-12 text-navy/60">
                  Voz do povo de Imbituba
                </p>
              </div>
            </div>
          </button>
          {isLogged && (
            <Link
              href="/minha-conta"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-fs-12 font-semibold text-navy/70 text-center hover:text-zimba-blue border-t border-border-subtle"
            >
              Ver minha conta →
            </Link>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? "Fechar menu de postar" : "Postar algo"}
        className={`inline-flex items-center gap-2 bg-zimba-gold text-navy font-display font-bold tracking-tight shadow-z-3 hover:bg-navy hover:text-zimba-gold transition-all duration-200 rounded-full h-14 ${
          open ? "px-5" : "pl-4 pr-5"
        }`}
      >
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-navy text-zimba-gold transition-transform ${
            open ? "rotate-45" : ""
          }`}
        >
          <Icon name="x" size={18} className="rotate-45" />
        </span>
        <span className="text-[12px] uppercase tracking-[0.22em] font-bold">
          {open ? "Fechar" : "Postar"}
        </span>
      </button>
    </div>
  );
}
