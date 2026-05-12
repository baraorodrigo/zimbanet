"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateSocialHashtags } from "@/lib/actions/studio";

type Props = {
  socialPostId: string;
  initialHashtags: string[];
  maxCount?: number;
};

// Sanitiza um item digitado: remove espaços e caracteres não-permitidos pelo IG.
function sanitizeTag(raw: string): string {
  const trimmed = raw.trim().replace(/^#+/, "");
  // Letras (qualquer alfabeto), números e _
  const cleaned = trimmed.replace(/[^\p{L}\p{N}_]/gu, "");
  return cleaned ? "#" + cleaned : "";
}

// Pills clicáveis com botão "+" pra adicionar. Salva no blur do input
// e sempre que array muda (pill removida via X também salva).
export function HashtagsEditor({ socialPostId, initialHashtags, maxCount = 30 }: Props) {
  const [tags, setTags] = useState<string[]>(initialHashtags);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [, startTransition] = useTransition();
  const lastSavedRef = useRef<string>(JSON.stringify(initialHashtags));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Re-sync quando troca de post
  useEffect(() => {
    setTags(initialHashtags);
    setDraft("");
    lastSavedRef.current = JSON.stringify(initialHashtags);
    setStatus("saved");
  }, [socialPostId, initialHashtags]);

  function persist(next: string[]) {
    const serialized = JSON.stringify(next);
    if (serialized === lastSavedRef.current) return;
    setStatus("saving");
    startTransition(async () => {
      try {
        await updateSocialHashtags(socialPostId, next);
        lastSavedRef.current = serialized;
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  function addTag(raw: string) {
    const tag = sanitizeTag(raw);
    if (!tag || tag.length < 2) return;
    if (tags.length >= maxCount) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      // já existe — apenas limpa o input
      setDraft("");
      return;
    }
    const next = [...tags, tag];
    setTags(next);
    setDraft("");
    setStatus("dirty");
    persist(next);
  }

  function removeAt(idx: number) {
    const next = tags.filter((_, i) => i !== idx);
    setTags(next);
    setStatus("dirty");
    persist(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      if (draft.trim()) addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && tags.length) {
      // backspace com input vazio remove última pill (UX padrão de tag input)
      e.preventDefault();
      removeAt(tags.length - 1);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    if (/[\s,#]/.test(text)) {
      e.preventDefault();
      const parts = text.split(/[\s,]+/).map(sanitizeTag).filter(Boolean);
      if (!parts.length) return;
      const merged = [...tags];
      for (const p of parts) {
        if (merged.length >= maxCount) break;
        if (!merged.some((t) => t.toLowerCase() === p.toLowerCase())) merged.push(p);
      }
      setTags(merged);
      setDraft("");
      setStatus("dirty");
      persist(merged);
    }
  }

  function onBlur() {
    if (draft.trim()) addTag(draft);
  }

  const remaining = maxCount - tags.length;

  return (
    <div className="rounded-md border border-border-subtle bg-white focus-within:border-zimba-gold focus-within:shadow-focus-gold transition-all">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
          Hashtags
        </span>
        <span
          className={`text-[10px] uppercase tracking-[0.18em] font-bold ${
            status === "error"
              ? "text-alert-red"
              : status === "saving"
                ? "text-zimba-blue"
                : status === "dirty"
                  ? "text-ink-500"
                  : "text-eco-green"
          }`}
        >
          {status === "saved"
            ? "salvo"
            : status === "saving"
              ? "salvando…"
              : status === "dirty"
                ? "salvando…"
                : "erro · tenta de novo"}
        </span>
      </div>

      <div
        className="px-4 pb-3 pt-1 flex flex-wrap gap-1.5 cursor-text min-h-[52px]"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-zimba-blue/10 text-zimba-blue text-fs-12 font-mono"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
              className="w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-alert-red hover:text-white text-zimba-blue transition-colors"
              aria-label={`Remover ${tag}`}
            >
              <span aria-hidden>×</span>
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={onBlur}
          placeholder={
            tags.length === 0
              ? "+ adicionar hashtag (enter, vírgula ou espaço)"
              : tags.length >= maxCount
                ? "limite de hashtags atingido"
                : "+ adicionar"
          }
          disabled={tags.length >= maxCount}
          className="flex-1 min-w-[160px] h-7 px-1 bg-transparent border-0 outline-none text-fs-13 font-mono text-ink-900 placeholder:text-ink-400 disabled:cursor-not-allowed"
          aria-label="Adicionar hashtag"
        />
      </div>

      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        <p className="text-fs-12 text-ink-400">
          Sem #s genéricos. Mira em locais e termos da matéria.
        </p>
        <p className="text-fs-12 font-mono text-ink-400">
          {tags.length}/{maxCount}
          {remaining > 0 && remaining <= 5 && (
            <span className="ml-1 text-zimba-gold">· {remaining} restantes</span>
          )}
        </p>
      </div>
    </div>
  );
}
