"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applySocialKitTemplate,
  applySocialKitTemplateToPost,
} from "@/lib/actions/media-studio";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; applied: number; skipped: number; errors: number }
  | { kind: "error"; message: string };

// Botão PRIMÁRIO do painel social: aplica o template oficial do social kit
// (Georgia + faixa dourada + pílula da editoria) usando o HERO atual da
// matéria como fundo. NÃO chama IA pra gerar imagem nenhuma — só renderiza
// HTML via Puppeteer no /api/social/render. Roda mesmo quando a matéria
// não tem hero (o template tem fallback gráfico).
export function TemplateButton({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function fire() {
    setState({ kind: "running" });
    startTransition(async () => {
      try {
        const res = await applySocialKitTemplate(articleId);
        setState({
          kind: "done",
          applied: res.applied,
          skipped: res.skipped,
          errors: res.errors.length,
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

  if (state.kind === "running") {
    return (
      <span className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold">
        <span className="w-2 h-2 rounded-full bg-zimba-gold animate-pulse" />
        Aplicando…
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
          state.errors > 0
            ? `${state.errors} canvas falharam — ver auditoria`
            : "Template aplicado em todos os canvas do pacote"
        }
      >
        ✓ {state.applied} aplicad{state.applied === 1 ? "o" : "os"}
        {state.errors > 0 && (
          <span className="text-alert-red"> · {state.errors} erro{state.errors === 1 ? "" : "s"}</span>
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

  return (
    <button
      type="button"
      onClick={fire}
      disabled={pending}
      className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors"
      title="Renderiza o template oficial (faixa dourada, pílula da editoria, Georgia) usando o hero atual da matéria. Não gera imagem nova — só aplica o layout do social kit."
    >
      🎨 Aplicar template
    </button>
  );
}

// Versão single-canvas: regera o template de UM post só. Visualmente
// pequeno — vai dentro do PostCard, ao lado do botão de aprovar.
export function TemplateButtonSingle({ socialPostId }: { socialPostId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [errMessage, setErrMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function fire() {
    setState("running");
    setErrMessage(null);
    startTransition(async () => {
      try {
        const res = await applySocialKitTemplateToPost(socialPostId);
        if (!res.ok) {
          setState("error");
          setErrMessage(res.error ?? "Erro desconhecido.");
          return;
        }
        setState("done");
        router.refresh();
        // Volta ao idle depois pra permitir reaplicar
        setTimeout(() => setState("idle"), 1600);
      } catch (err) {
        setState("error");
        setErrMessage(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (state === "running") {
    return (
      <span className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-navy text-zimba-gold text-[10px] uppercase tracking-[0.2em] font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-zimba-gold animate-pulse" />
        aplicando
      </span>
    );
  }

  if (state === "done") {
    return (
      <span className="h-8 px-3 inline-flex items-center rounded-md bg-eco-green text-white text-[10px] uppercase tracking-[0.2em] font-bold">
        ✓ template
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={fire}
      disabled={pending}
      title={
        errMessage
          ? errMessage
          : "Aplica o template oficial nesse canvas usando o hero atual — sem gerar imagem com IA."
      }
      className={`h-8 px-3 rounded-md text-[10px] uppercase tracking-[0.2em] font-bold transition-colors ${
        state === "error"
          ? "border border-alert-red text-alert-red hover:bg-alert-red hover:text-white"
          : "bg-zimba-gold text-navy hover:bg-navy hover:text-zimba-gold"
      }`}
    >
      🎨 Template
    </button>
  );
}
