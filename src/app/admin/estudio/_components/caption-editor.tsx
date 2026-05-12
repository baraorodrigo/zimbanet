"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateSocialCaption } from "@/lib/actions/studio";

type Props = {
  socialPostId: string;
  initialCaption: string;
  // Cap visual; o servidor também faz o corte em 2200.
  maxLength?: number;
};

const STATUS_TEXT = {
  saved: "salvo",
  saving: "salvando…",
  dirty: "alterado · sai do campo pra salvar",
  error: "erro · tenta de novo",
} as const;

type Status = keyof typeof STATUS_TEXT;

// Editor inline estilo Notion/Linear:
// - autosize por linhas
// - sem botão "salvar" — debounce no blur
// - Ctrl/Cmd+S força salvar imediatamente sem perder foco
// - contador no canto direito muda pra alert-red passando 90% do cap
export function CaptionEditor({ socialPostId, initialCaption, maxLength = 2200 }: Props) {
  const [value, setValue] = useState(initialCaption);
  const [status, setStatus] = useState<Status>("saved");
  const [isPending, startTransition] = useTransition();
  const lastSavedRef = useRef(initialCaption);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync se o prop mudar (ex: usuário troca de canal e o componente re-monta com novo id+caption)
  useEffect(() => {
    setValue(initialCaption);
    lastSavedRef.current = initialCaption;
    setStatus("saved");
  }, [socialPostId, initialCaption]);

  // Autosize do textarea
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 600) + "px";
  }, [value]);

  function flush() {
    if (value === lastSavedRef.current) return;
    setStatus("saving");
    startTransition(async () => {
      try {
        await updateSocialCaption(socialPostId, value);
        lastSavedRef.current = value;
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setValue(next);
    if (next !== lastSavedRef.current) {
      setStatus("dirty");
    } else {
      setStatus("saved");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl/Cmd+S = salva sem perder foco
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      flush();
    }
  }

  const len = value.length;
  const overSoft = len > maxLength * 0.9;
  const overHard = len > maxLength;

  return (
    <div className="rounded-md border border-border-subtle bg-white focus-within:border-zimba-gold focus-within:shadow-focus-gold transition-all">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
          Legenda
        </span>
        <span
          className={`text-[10px] uppercase tracking-[0.18em] font-bold ${
            status === "error"
              ? "text-alert-red"
              : status === "saving" || isPending
                ? "text-zimba-blue"
                : status === "dirty"
                  ? "text-ink-500"
                  : "text-eco-green"
          }`}
        >
          {STATUS_TEXT[status]}
        </span>
      </div>

      <textarea
        ref={taRef}
        value={value}
        onChange={onChange}
        onBlur={flush}
        onKeyDown={onKeyDown}
        placeholder="Escreva a legenda — o que faz alguém parar o scroll. Sem punchline genérica, sem 'confira' no fim."
        className="w-full px-4 pb-2 pt-1 bg-transparent border-0 outline-none resize-none text-fs-15 text-ink-900 leading-relaxed font-sans placeholder:text-ink-400 min-h-[120px]"
        rows={5}
        spellCheck
        aria-label="Legenda do post"
      />

      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        <p className="text-fs-12 text-ink-400">
          Ctrl/⌘ S salva agora · sai do campo pra salvar automaticamente
        </p>
        <p
          className={`text-fs-12 font-mono ${
            overHard ? "text-alert-red font-bold" : overSoft ? "text-zimba-gold" : "text-ink-400"
          }`}
        >
          {len}/{maxLength}
        </p>
      </div>
    </div>
  );
}
