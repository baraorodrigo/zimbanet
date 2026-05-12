"use client";

import { useEffect, useState } from "react";

type ToastDetail = {
  action?: string;
  socialPostId?: string;
  applied?: string;
  count?: number;
};

const ACTION_LABEL: Record<string, string> = {
  apply_variation: "Variação aplicada",
  fetch_source_image: "Imagem da fonte aplicada",
  upload_image: "Upload aplicado",
  auto_adapt: "Captions adaptadas",
};

// UndoToast — escuta `zb-show-undo` (disparado por VariationsGallery,
// MediaSourcePicker e AutoAdaptButton) e mostra toast no canto inferior
// direito por 6s. Sem rollback real ainda — fica como gancho pra Fase D+.
export function UndoToast() {
  const [toast, setToast] = useState<{ msg: string; sub?: string } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onShow(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail ?? {};
      const msg = ACTION_LABEL[detail.action ?? ""] ?? "Ação registrada";
      const sub =
        typeof detail.count === "number"
          ? `${detail.count} canal${detail.count > 1 ? "is" : ""}`
          : undefined;
      setToast({ msg, sub });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 6000);
    }
    window.addEventListener("zb-show-undo", onShow as EventListener);
    return () => {
      window.removeEventListener("zb-show-undo", onShow as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 right-4 z-40 bg-navy text-zimba-gold rounded-md shadow-z-3 px-4 py-3 flex items-center gap-3 max-w-[320px] animate-in fade-in slide-in-from-bottom-2"
    >
      <span aria-hidden className="text-fs-16">✓</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold leading-tight">
          {toast.msg}
        </p>
        {toast.sub && (
          <p className="text-[10px] text-zimba-gold/70 mt-0.5">{toast.sub}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setToast(null)}
        className="ml-2 text-zimba-gold/70 hover:text-zimba-gold text-fs-12"
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
}
