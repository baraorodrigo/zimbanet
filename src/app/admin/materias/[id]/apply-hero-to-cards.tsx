"use client";

import { useState, useTransition } from "react";
import { applyHeroToAllSocialPosts } from "@/lib/actions/media-studio";

// Botão "↪ Usar essa foto em todos os cards" — copia o hero atual pra
// todos os social_posts não-text_only e não-published da matéria.
// Útil quando admin acabou de subir/escolher uma foto real e quer
// padronizar o pacote inteiro sem entrar em cada canvas.
export function ApplyHeroToCards({
  articleId,
  hasHero,
}: {
  articleId: string;
  hasHero: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  function fire() {
    setConfirming(false);
    setMsg(null);
    setErrMsg(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await applyHeroToAllSocialPosts(articleId);
        const card = res.applied === 1 ? "card" : "cards";
        setMsg(
          res.skipped > 0
            ? `✓ ${res.applied} ${card} aplicad${res.applied === 1 ? "o" : "os"} · ${res.skipped} ignorado${res.skipped === 1 ? "" : "s"} (texto/publicado)`
            : `✓ ${res.applied} ${card} aplicad${res.applied === 1 ? "o" : "os"}`,
        );
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Erro ao aplicar.");
      } finally {
        setBusy(false);
      }
    });
  }

  if (!hasHero) return null;

  if (confirming) {
    return (
      <div className="border-t border-border-subtle pt-4">
        <h3 className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500">
          Confirma sobrescrever os cards?
        </h3>
        <p className="text-fs-12 text-ink-700 mt-1 max-w-[60ch]">
          Vai trocar a imagem de todos os cards sociais (IG feed, stories,
          carrossel, FB, etc) pela foto do hero. Posts já publicados não são
          afetados.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fire}
            disabled={busy}
            className="h-10 px-4 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-50"
          >
            Sim, sobrescrever
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="h-10 px-4 rounded-md border-2 border-border-subtle text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold hover:border-navy hover:text-navy transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border-subtle pt-4">
      <h3 className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500">
        Aplicar nos cards sociais
      </h3>
      <p className="text-fs-12 text-ink-700 mt-1 max-w-[60ch]">
        Usa essa foto do hero como capa de todos os cards do pacote (IG feed,
        stories, carrossel, FB…). Texto e publicados ficam intactos.
      </p>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="mt-2 h-10 px-4 rounded-md bg-zimba-blue text-white text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? "Aplicando..." : "↪ Usar essa foto nos cards"}
      </button>
      {msg && <p className="mt-2 text-fs-12 text-eco-green">{msg}</p>}
      {errMsg && <p className="mt-2 text-fs-12 text-alert-red">{errMsg}</p>}
    </div>
  );
}
