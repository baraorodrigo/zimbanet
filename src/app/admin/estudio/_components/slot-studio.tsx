"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  buildPromptFromSlots,
  coerceVisualSlots,
  deriveDefaultSlots,
  DEFAULT_SLOTS,
  FRAMING_OPTIONS,
  MOOD_OPTIONS,
  SCENE_MAX,
  STYLE_OPTIONS,
  SUBJECT_MAX,
  type VisualFraming,
  type VisualMood,
  type VisualSlots,
  type VisualStyle,
} from "@/lib/visual-slots";
import {
  regenerateImageFromSlots,
  resetVisualSlots,
  updateVisualSlots,
} from "@/lib/actions/visual-slots";

type SlotStudioProps = {
  articleId: string;
  socialPostId: string;
  initialSlots: VisualSlots | null;
  initialArticle: {
    editoria: string;
    cities?: string[] | null;
    tags?: string[] | null;
    title: string;
  };
};

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 400;

// SlotStudio — painel direito do Estúdio, cabe dentro do `properties-shell`
// (~360px). Auto-save no blur, regen via dispatchEvent("zb-empty-action",
// {action:"generate"}) pra VariationsGallery escutar.
export function SlotStudio({
  articleId,
  socialPostId,
  initialSlots,
  initialArticle,
}: SlotStudioProps) {
  const [slots, setSlots] = useState<VisualSlots>(() => {
    if (initialSlots && (initialSlots.subject || initialSlots.scene)) {
      return coerceVisualSlots(initialSlots);
    }
    // Sem slots salvos -> deriva defaults da editoria. Não persiste sozinho;
    // o admin pode ajustar antes do primeiro auto-save.
    return deriveDefaultSlots(initialArticle);
  });

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(slots));

  const compiledPrompt = useMemo(() => buildPromptFromSlots(slots), [slots]);

  // ---- Auto-save debounced ------------------------------------
  const scheduleSave = useCallback(
    (next: VisualSlots) => {
      const serialized = JSON.stringify(next);
      if (serialized === lastSavedRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSaveState("saving");
        setErrorMsg(null);
        startTransition(async () => {
          try {
            await updateVisualSlots(articleId, next);
            lastSavedRef.current = serialized;
            setSaveState("saved");
            // volta pra "idle" após uns segundos pra não poluir o painel
            setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
          } catch (err) {
            setSaveState("error");
            setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar.");
          }
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [articleId],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const update = useCallback(
    <K extends keyof VisualSlots>(key: K, value: VisualSlots[K]) => {
      setSlots((prev) => {
        const next = { ...prev, [key]: value };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const handleReset = useCallback(() => {
    setSaveState("saving");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const fresh = await resetVisualSlots(articleId);
        setSlots(fresh);
        lastSavedRef.current = JSON.stringify(fresh);
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch (err) {
        setSaveState("error");
        setErrorMsg(err instanceof Error ? err.message : "Erro ao resetar.");
      }
    });
  }, [articleId]);

  const handleRegenerate = useCallback(() => {
    setErrorMsg(null);
    setSaveState("saving");
    startTransition(async () => {
      try {
        // garante que o último estado foi persistido antes de enfileirar
        await updateVisualSlots(articleId, slots);
        lastSavedRef.current = JSON.stringify(slots);
        const result = await regenerateImageFromSlots(articleId, socialPostId);
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);

        // Sinaliza pro canvas central / preview que pode entrar em estado
        // "gerando". A VariationsGallery consome esse evento.
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zb-empty-action", {
              detail: { action: "generate", articleId, socialPostId },
            }),
          );
        }

        setToast(result.message ?? "Variações ainda não disponíveis");
        setTimeout(() => setToast(null), 4000);
      } catch (err) {
        setSaveState("error");
        setErrorMsg(err instanceof Error ? err.message : "Erro ao gerar.");
      }
    });
  }, [articleId, socialPostId, slots]);

  // ---------------------------------------------------------------
  return (
    <aside
      className="flex flex-col h-full overflow-y-auto bg-off-white border-l border-border-subtle"
      aria-label="Editor de slots visuais"
    >
      <header className="sticky top-0 z-10 bg-off-white px-5 pt-5 pb-3 border-b border-border-subtle">
        <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
          Prompt (slots)
        </p>
        <p className="font-display font-black text-fs-16 text-navy mt-1 leading-tight">
          O que o Visual agent recebe
        </p>
        <SaveBadge state={saveState} pending={isPending} />
      </header>

      <div className="px-5 py-5 space-y-5">
        {/* SUBJECT ---------------------------------------------------- */}
        <Field
          label="Sujeito"
          hint="1 frase concreta — quem/o quê é o protagonista da imagem."
          counter={`${slots.subject.length}/${SUBJECT_MAX}`}
        >
          <textarea
            value={slots.subject}
            onChange={(e) => update("subject", e.target.value.slice(0, SUBJECT_MAX))}
            rows={2}
            placeholder="Pescador descarregando tainha no trapiche"
            className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-fs-14 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-zimba-gold focus:shadow-focus-gold resize-none"
          />
        </Field>

        {/* SCENE ----------------------------------------------------- */}
        <Field
          label="Cena"
          hint="Ambiente, momento, ancoragem geográfica."
          counter={`${slots.scene.length}/${SCENE_MAX}`}
        >
          <textarea
            value={slots.scene}
            onChange={(e) => update("scene", e.target.value.slice(0, SCENE_MAX))}
            rows={2}
            placeholder="Trapiche da Vila ao amanhecer, com gaivotas"
            className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-fs-14 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-zimba-gold focus:shadow-focus-gold resize-none"
          />
        </Field>

        {/* FRAMING --------------------------------------------------- */}
        <ChipGroup<VisualFraming>
          label="Enquadramento"
          options={FRAMING_OPTIONS}
          value={slots.framing}
          onChange={(v) => update("framing", v)}
        />

        {/* MOOD ------------------------------------------------------ */}
        <ChipGroup<VisualMood>
          label="Atmosfera"
          options={MOOD_OPTIONS}
          value={slots.mood}
          onChange={(v) => update("mood", v)}
        />

        {/* STYLE ----------------------------------------------------- */}
        <ChipGroup<VisualStyle>
          label="Estilo"
          options={STYLE_OPTIONS}
          value={slots.style}
          onChange={(v) => update("style", v)}
        />

        {/* AVANÇADO -------------------------------------------------- */}
        <details className="rounded-md border border-border-subtle bg-white">
          <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 hover:text-navy">
            <span>Avançado — tom da marca / negative</span>
            <span className="text-zimba-gold text-fs-13">+</span>
          </summary>
          <div className="px-3 pb-3 space-y-3">
            <Field
              label="Tom da marca"
              hint="Modificadores cromáticos e de densidade."
            >
              <input
                type="text"
                value={slots.brand_tone}
                onChange={(e) => update("brand_tone", e.target.value)}
                placeholder={DEFAULT_SLOTS.brand_tone}
                className="w-full rounded-md border border-border-subtle bg-off-white px-3 py-2 text-fs-13 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-zimba-gold focus:shadow-focus-gold"
              />
            </Field>
            <Field label="Negative" hint="O que NÃO pode aparecer.">
              <input
                type="text"
                value={slots.negative}
                onChange={(e) => update("negative", e.target.value)}
                placeholder={DEFAULT_SLOTS.negative}
                className="w-full rounded-md border border-border-subtle bg-off-white px-3 py-2 text-fs-13 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-zimba-gold focus:shadow-focus-gold"
              />
            </Field>
          </div>
        </details>

        {/* PROMPT COMPILADO ----------------------------------------- */}
        <details className="rounded-md border border-navy/15 bg-navy/[0.03]">
          <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-blue hover:text-navy">
            <span>Ver prompt gerado</span>
            <span className="text-zimba-gold text-fs-13">+</span>
          </summary>
          <pre className="px-3 pb-3 pt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-700">
            {compiledPrompt}
          </pre>
        </details>

        {errorMsg && (
          <div className="rounded-md border border-alert-red/30 bg-alert-red/5 p-3 text-fs-12 text-alert-red">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Footer fixo com CTA --------------------------------------- */}
      <footer className="sticky bottom-0 bg-off-white border-t border-border-subtle px-5 py-4 space-y-2">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          className="w-full h-12 rounded-md bg-zimba-gold text-navy font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <span aria-hidden>{"⚡"}</span>
          <span>Gerar imagem com esses slots</span>
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="w-full h-9 rounded-md border border-border-subtle bg-white text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold hover:border-zimba-blue hover:text-zimba-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {"↺"} Resetar pro default da editoria
        </button>
        {toast && (
          <p className="text-fs-12 text-eco-green text-center pt-1">{toast}</p>
        )}
      </footer>
    </aside>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function Field({
  label,
  hint,
  counter,
  children,
}: {
  label: string;
  hint?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-700">
          {label}
        </span>
        {counter && (
          <span className="text-[10px] font-mono text-ink-400">{counter}</span>
        )}
      </span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-ink-500">{hint}</span>}
    </label>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-700 mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                "px-3 h-8 rounded-full text-[11px] uppercase tracking-[0.18em] font-bold transition-colors " +
                (active
                  ? "bg-zimba-gold text-navy border border-zimba-gold"
                  : "bg-white text-ink-700 border border-navy/15 hover:border-zimba-blue hover:text-zimba-blue")
              }
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SaveBadge({ state, pending }: { state: SaveState; pending: boolean }) {
  if (state === "idle" && !pending) return null;
  const map: Record<SaveState, { label: string; cls: string }> = {
    idle: { label: "...", cls: "text-ink-400" },
    saving: { label: "salvando...", cls: "text-ink-500" },
    saved: { label: "salvo", cls: "text-eco-green" },
    error: { label: "erro ao salvar", cls: "text-alert-red" },
  };
  const cur = pending && state !== "error" ? map.saving : map[state];
  return (
    <p className={`mt-2 text-[10px] uppercase tracking-[0.22em] font-bold ${cur.cls}`}>
      {cur.label}
    </p>
  );
}
