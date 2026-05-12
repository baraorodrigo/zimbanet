"use client";

import { useCallback } from "react";

type EmptyCanvasProps = {
  articleId: string;
  socialPostId: string;
  // Opcional — se a Fase A quiser substituir o dispatch global por uma callback,
  // basta passar a prop. Default = window.dispatchEvent("zb-empty-action").
  onAction?: (action: EmptyAction) => void;
};

export type EmptyAction = "generate" | "source" | "upload";

// EmptyCanvas — estado vazio do canvas central quando o post ainda não tem
// mídia. É a entrada principal pra escolher caminho. Os 3 botões disparam
// CustomEvent("zb-empty-action") que Fase A/C escutam.
export function EmptyCanvas({ articleId, socialPostId, onAction }: EmptyCanvasProps) {
  const dispatch = useCallback(
    (action: EmptyAction) => {
      if (onAction) {
        onAction(action);
        return;
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zb-empty-action", {
            detail: { action, articleId, socialPostId },
          }),
        );
      }
    },
    [onAction, articleId, socialPostId],
  );

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="w-full max-w-[640px] rounded-lg border-2 border-dashed border-border-subtle bg-white p-8 text-center">
        <p className="font-display font-black text-fs-20 text-navy">
          Esse post ainda não tem mídia.
        </p>
        <p className="text-fs-13 text-ink-500 mt-2">
          Escolhe por onde começar — dá pra trocar depois.
        </p>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ActionCard
            highlight
            icon={"✦"}
            label="Gerar com IA"
            sub="usa os slots da direita"
            onClick={() => dispatch("generate")}
          />
          <ActionCard
            icon={"⤓"}
            label="Da fonte"
            sub="puxar imagem do RSS"
            onClick={() => dispatch("source")}
          />
          <ActionCard
            icon={"↑"}
            label="Upload manual"
            sub="enviar do computador"
            onClick={() => dispatch("upload")}
          />
        </div>

        <p className="mt-5 text-[11px] uppercase tracking-[0.22em] font-bold text-ink-400">
          ou mantém só com texto / template
        </p>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  label,
  sub,
  onClick,
  highlight,
}: {
  icon: string;
  label: string;
  sub: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  // Cards 1:1 — IA em destaque dourado, os outros mais discretos.
  const base =
    "aspect-square w-full rounded-md flex flex-col items-center justify-center gap-1.5 p-3 transition-colors text-center";
  const cls = highlight
    ? base +
      " bg-zimba-gold text-navy border border-zimba-gold hover:bg-navy hover:text-zimba-gold"
    : base +
      " bg-white text-navy border border-border-subtle hover:border-zimba-blue hover:text-zimba-blue";

  return (
    <button type="button" onClick={onClick} className={cls}>
      <span aria-hidden className="text-fs-28 leading-none font-bold">
        {icon}
      </span>
      <span className="font-display font-bold text-fs-14 leading-tight uppercase tracking-[0.12em]">
        {label}
      </span>
      <span
        className={
          "text-[10px] uppercase tracking-[0.18em] font-bold " +
          (highlight ? "text-navy/70" : "text-ink-500")
        }
      >
        {sub}
      </span>
    </button>
  );
}
