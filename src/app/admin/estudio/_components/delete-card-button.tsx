"use client";

import { deleteSocialPost } from "@/lib/actions/social";

type Props = {
  id: string;
  label: string;
  isActive: boolean;
};

// Botão ✕ discreto no canto de cada card do ChannelRail.
// Confirma antes, pra não apagar por acidente. Hard delete — diferente
// do dismiss que só marca como failed.
export function DeleteCardButton({ id, label, isActive }: Props) {
  return (
    <form
      action={deleteSocialPost}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Apagar ${label}? Some pra sempre. Se for só pra esconder, use "descartar".`,
        );
        if (!ok) e.preventDefault();
      }}
      className="absolute top-1.5 right-1.5"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title={`Apagar ${label}`}
        aria-label={`Apagar ${label}`}
        className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-[12px] font-bold leading-none transition-colors ${
          isActive
            ? "bg-navy/10 text-navy hover:bg-alert-red hover:text-white"
            : "bg-white/0 text-ink-400 opacity-0 group-hover:opacity-100 hover:bg-alert-red hover:text-white"
        }`}
      >
        ✕
      </button>
    </form>
  );
}
