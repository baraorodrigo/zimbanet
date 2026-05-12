"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

type Props = {
  email: string | null;
  initials: string;
};

export default function UserMenu({ email, initials }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
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
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 font-semibold text-navy hover:text-zimba-blue"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="w-7 h-7 rounded-full bg-navy text-zimba-gold font-display font-black text-[11px] flex items-center justify-center tracking-[-0.02em]">
          {initials}
        </span>
        <span className="hidden md:inline">Conta</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 bg-white border border-border-subtle shadow-z-2 rounded-md overflow-hidden z-50"
        >
          {email && (
            <div className="px-4 py-3 border-b border-border-subtle">
              <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-400">
                Logado como
              </p>
              <p className="text-fs-13 text-navy truncate" title={email}>
                {email}
              </p>
            </div>
          )}
          <Link
            href="/minha-conta"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-fs-13 font-semibold text-navy hover:bg-navy hover:text-zimba-gold transition-colors border-b border-border-subtle"
          >
            Minha conta
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-4 py-3 text-fs-13 font-semibold text-navy hover:bg-navy hover:text-zimba-gold transition-colors"
            >
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
