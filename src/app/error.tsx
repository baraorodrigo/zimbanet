"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[zimbanet] route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-off-white grid place-items-center px-6">
      <div className="max-w-[56ch] text-center">
        <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-alert-red mb-3">
          Erro no servidor
        </p>
        <h1 className="font-display text-fs-44 lg:text-fs-56 font-black tracking-tight2 text-navy mb-4 leading-none">
          Algo travou
          <br />
          do nosso lado.
        </h1>
        <p className="text-fs-16 text-ink-700 mb-8">
          A redação foi notificada. Tente recarregar — se persistir, volte daqui a pouco.
        </p>
        {error.digest && (
          <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-ink-400 mb-6">
            ref: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-11 hover:bg-zimba-gold hover:text-navy transition-colors"
          >
            Tentar de novo
          </button>
          <Link
            href="/"
            className="bg-white border border-navy/15 text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-11 inline-flex items-center hover:border-zimba-gold transition-colors"
          >
            Voltar pra capa
          </Link>
        </div>
      </div>
    </div>
  );
}
