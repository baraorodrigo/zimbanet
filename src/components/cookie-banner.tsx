"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "zimbanet_cookie_consent_v1";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const v = window.localStorage.getItem(KEY);
      if (!v) setShow(true);
    } catch {
      // localStorage indisponível (modo privado em alguns browsers): não exibir
    }
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ok: true, at: Date.now() }));
    } catch {
      // ignora erro de storage — usuário fica vendo até trocar de browser
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de privacidade"
      className="fixed inset-x-3 bottom-3 z-50 md:inset-x-auto md:right-4 md:bottom-4 md:max-w-md"
    >
      <div className="rounded-md border border-zimba-gold/40 bg-navy text-off-white shadow-2xl p-4 md:p-5">
        <p className="font-sans text-fs-13 leading-relaxed text-off-white/90">
          A gente usa <strong>cookies essenciais</strong> pra fazer o portal funcionar
          (login, sessão, preferência) e métricas agregadas pra entender o que você lê.
          Detalhes na nossa{" "}
          <Link href="/privacidade" className="text-zimba-gold underline font-semibold">
            política de privacidade
          </Link>
          .
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={accept}
            className="bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold px-4 h-9 rounded-xs hover:bg-off-white transition-colors"
          >
            Entendido
          </button>
          <Link
            href="/privacidade"
            className="text-[11px] uppercase tracking-[0.22em] font-bold text-off-white/70 hover:text-zimba-gold inline-flex items-center px-3 h-9"
          >
            Saiba mais
          </Link>
        </div>
      </div>
    </div>
  );
}
