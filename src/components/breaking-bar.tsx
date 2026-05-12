"use client";

import Link from "next/link";
import { useState } from "react";

export type TickerItem = {
  id: string;
  text: string;
  kicker?: string | null;
  href?: string | null;
};

type Props = {
  items: TickerItem[];
};

// Faixa vermelha abaixo do header — selo "Agora" à esquerda + ticker correndo.
// Recebe items já normalizados (ou de manchetes do dia, ou de mensagens
// configuradas no /admin/ticker). Animação CSS pura em globals.css.
//
// Acessibilidade:
// - role="region" + aria-label pra screen reader anunciar
// - aria-live="polite" pra notificar quando o conteúdo muda
// - botão pause/play (essencial pra WCAG 2.2.2 — controle de movimento)
// - prefers-reduced-motion zera a animação via CSS (globals.css)
export default function BreakingBar({ items }: Props) {
  const [paused, setPaused] = useState(false);
  const filtered = items.filter((it) => it.text?.trim()).slice(0, 16);
  if (filtered.length === 0) return null;

  // Duplica pra loop contínuo sem corte visual.
  const loop = [...filtered, ...filtered];

  return (
    <div
      className="bg-alert-red text-white border-b border-black/20 overflow-hidden"
      role="region"
      aria-label="Avisos e manchetes"
    >
      <div className="zb-container flex items-center h-8">
        <span className="bg-white text-alert-red font-sans font-bold text-[10px] uppercase tracking-[0.22em] px-2.5 py-1 inline-flex items-center shrink-0 leading-none mr-4">
          Agora
        </span>

        <div className="relative flex-1 overflow-hidden">
          <div
            className="zb-ticker-track flex items-center whitespace-nowrap will-change-transform"
            data-paused={paused ? "true" : undefined}
            aria-live="polite"
            aria-atomic="false"
          >
            {loop.map((it, i) => {
              const content = (
                <span className="inline-flex items-center gap-3 text-fs-12 font-sans text-white">
                  {it.kicker && (
                    <>
                      <span className="uppercase tracking-[0.18em] text-[10px] font-bold text-white/75">
                        {it.kicker}
                      </span>
                      <span aria-hidden className="text-white/40 text-[10px]">
                        |
                      </span>
                    </>
                  )}
                  <span className="font-medium text-white">{it.text}</span>
                </span>
              );
              return it.href ? (
                <Link
                  key={`${it.id}-${i}`}
                  href={it.href}
                  className="mr-8 last:mr-0 hover:text-white"
                >
                  {content}
                </Link>
              ) : (
                <span key={`${it.id}-${i}`} className="mr-8 last:mr-0">
                  {content}
                </span>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? "Retomar ticker" : "Pausar ticker"}
          className="ml-3 shrink-0 inline-flex items-center justify-center w-6 h-6 text-white/85 hover:text-white border border-white/30 hover:border-white/70 transition-colors"
        >
          {paused ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
