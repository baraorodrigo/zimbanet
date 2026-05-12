"use client";

import { useState, useTransition } from "react";
import { approvePackPending } from "@/lib/actions/social";

// Botão "✓ Aprovar pendentes (N)" no header do rail. Aparece quando N ≥ 2 —
// pra 1 só, admin clica direto no card. Confirma antes (zerá uma ação em massa).
export function ApprovePendingButton({
  articleId,
  pendingCount,
}: {
  articleId: string;
  pendingCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  if (pendingCount < 2) return null;

  function fire() {
    setConfirming(false);
    setMsg(null);
    setErrMsg(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await approvePackPending(articleId);
        setMsg(`✓ ${res.approved} aprovad${res.approved === 1 ? "o" : "os"}`);
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Erro ao aprovar.");
      } finally {
        setBusy(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="mt-2.5 rounded border border-zimba-gold/40 bg-gold-50 p-2.5">
        <p className="text-fs-12 text-ink-700 leading-snug">
          Marcar os <strong>{pendingCount}</strong> pendentes como prontos?
        </p>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={fire}
            disabled={busy}
            className="h-7 px-2.5 rounded bg-zimba-gold text-navy text-[10px] uppercase tracking-[0.18em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="h-7 px-2.5 rounded border border-border-subtle text-ink-600 text-[10px] uppercase tracking-[0.18em] font-bold hover:border-navy hover:text-navy transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="w-full h-8 px-2.5 rounded bg-zimba-blue text-white text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? "Aprovando..." : `✓ Aprovar pendentes (${pendingCount})`}
      </button>
      {msg && <p className="mt-1.5 text-fs-11 text-eco-green">{msg}</p>}
      {errMsg && <p className="mt-1.5 text-fs-11 text-alert-red">{errMsg}</p>}
    </div>
  );
}
