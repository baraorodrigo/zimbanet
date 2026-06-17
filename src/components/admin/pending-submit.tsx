"use client";

import { useFormStatus } from "react-dom";

// Botão de submit que mostra estado "trabalhando" enquanto o Server Action roda.
// Usado em ações de IA lentas (ex: Redigir com IA ~30s) pra não parecer travado.
export function PendingSubmit({
  children,
  pendingLabel,
  className,
  title,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      title={title}
      className={`inline-flex items-center justify-center gap-2 ${pending ? "opacity-80 cursor-wait" : ""} ${className ?? ""}`}
    >
      {pending && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin"
        />
      )}
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}
