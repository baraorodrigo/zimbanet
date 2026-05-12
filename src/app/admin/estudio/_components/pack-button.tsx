"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePack } from "@/lib/actions/media-studio";

type State =
  | { kind: "idle" }
  | { kind: "generating"; startedAt: number }
  | { kind: "done"; ok: number; err: number }
  | { kind: "error"; message: string };

// Botão "✦ Gerar pacote" — substitui o fluxo per-canvas. Uma chamada
// gera 1 imagem por canal (no tamanho nativo) + 1 hero 16:9 pra
// articles.hero_image_url. Aplica TUDO automaticamente.
export function PackButton({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function fire() {
    setConfirming(false);
    setState({ kind: "generating", startedAt: Date.now() });
    startTransition(async () => {
      try {
        const res = await generatePack(articleId);
        setState({
          kind: "done",
          ok: res.items.length,
          err: res.errors.length,
        });
        router.refresh();
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  if (state.kind === "generating") {
    return (
      <span className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold">
        <span className="w-2 h-2 rounded-full bg-zimba-gold animate-pulse" />
        Gerando pacote…
      </span>
    );
  }

  if (state.kind === "done") {
    return (
      <button
        type="button"
        onClick={() => setState({ kind: "idle" })}
        className="h-9 px-3 inline-flex items-center gap-2 rounded-md border border-eco-green bg-eco-green/10 text-eco-green text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-eco-green hover:text-white transition-colors"
        title={
          state.err > 0
            ? `${state.err} canvas falharam — ver auditoria`
            : "Pacote aplicado nos canais e no hero da matéria"
        }
      >
        ✓ {state.ok} aplicad{state.ok === 1 ? "a" : "as"}
        {state.err > 0 && (
          <span className="text-alert-red"> · {state.err} erro{state.err === 1 ? "" : "s"}</span>
        )}
      </button>
    );
  }

  if (state.kind === "error") {
    return (
      <button
        type="button"
        onClick={fire}
        disabled={pending}
        className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-alert-red bg-alert-red/5 text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-alert-red hover:text-white transition-colors"
        title={state.message}
      >
        ✕ Falhou — clique pra tentar
      </button>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-stretch gap-2">
        <button
          type="button"
          onClick={fire}
          disabled={pending}
          className="h-9 px-4 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors"
        >
          Confirmar — sobrescreve tudo
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-9 px-3 rounded-md border border-border-subtle text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold hover:border-navy hover:text-navy transition-colors"
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={pending}
      className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors"
      title="Gera 1 imagem por canvas (IG feed, stories, FB, etc) + 1 hero da matéria. Aplica tudo de uma vez."
    >
      ✦ Gerar pacote
    </button>
  );
}
