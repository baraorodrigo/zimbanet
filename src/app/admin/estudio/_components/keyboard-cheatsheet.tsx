"use client";

import { useEffect, useState } from "react";

const SHORTCUTS: { keys: string[]; label: string; group: string }[] = [
  { keys: ["⌘", "↵"], label: "Aprovar pacote", group: "ações" },
  { keys: ["⌘", "⌫"], label: "Descartar post", group: "ações" },
  { keys: ["G"], label: "Gerar 4 variações IA", group: "mídia" },
  { keys: ["S"], label: "Puxar imagem da fonte", group: "mídia" },
  { keys: ["U"], label: "Upload manual", group: "mídia" },
  { keys: ["A"], label: "Auto-adapt caption pros outros canais", group: "texto" },
  { keys: ["1", "…", "7"], label: "Trocar canal ativo", group: "navegação" },
  { keys: ["?"], label: "Abrir/fechar este painel", group: "ajuda" },
  { keys: ["Esc"], label: "Fechar overlays", group: "ajuda" },
];

// KeyboardCheatsheet — Fase D. Tecla `?` abre/fecha um modal central com
// todos os atalhos. Vive global no estúdio (mounted no page.tsx).
export function KeyboardCheatsheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable);

      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      // `?` shift+/ — só fora de campo editável pra não roubar tipos
      if (e.key === "?" && !inEditable) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir atalhos de teclado"
        className="fixed bottom-4 left-4 z-30 hidden lg:flex w-9 h-9 items-center justify-center rounded-full bg-navy text-zimba-gold shadow-z-3 text-fs-14 font-bold hover:bg-zimba-gold hover:text-navy transition-colors"
        title="Atalhos (?)"
      >
        ?
      </button>
    );
  }

  // agrupa por categoria
  const grouped = SHORTCUTS.reduce<Record<string, typeof SHORTCUTS>>((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheatsheet-title"
    >
      <div
        className="bg-white rounded-lg shadow-z-3 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
              Estúdio
            </p>
            <h2
              id="cheatsheet-title"
              className="font-display font-black text-fs-20 text-navy leading-tight"
            >
              Atalhos de teclado
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-navy/5 flex items-center justify-center text-navy"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-blue mb-2">
                {group}
              </p>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-3 text-fs-13"
                  >
                    <span className="text-ink-700">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="bg-off-white border border-border-subtle text-navy px-1.5 py-0.5 rounded font-mono text-[11px] min-w-[24px] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-4 pt-3 border-t border-border-subtle text-[11px] text-ink-500">
          Pressione <kbd className="font-mono">Esc</kbd> ou clique fora pra fechar.
        </p>
      </div>
    </div>
  );
}
