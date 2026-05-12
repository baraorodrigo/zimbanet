"use client";

import { useRef, useState, useTransition } from "react";
import { uploadArticleHeroFromForm } from "@/lib/actions/media-studio";

// Botão "↑ Subir do computador" pra trocar o hero da matéria. Espelha o
// fluxo do MediaSourcePicker (Estúdio social): file picker oculto, submit
// automático no onChange, useTransition pra feedback.
export function HeroUpload({
  articleId,
  hasHero,
}: {
  articleId: string;
  hasHero: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleClick() {
    setMsg(null);
    setErrMsg(null);
    fileInputRef.current?.click();
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrMsg("Só aceitamos imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrMsg("Imagem maior que 10 MB.");
      return;
    }
    setBusy(true);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("article_id", articleId);
        fd.set("file", file);
        await uploadArticleHeroFromForm(fd);
        setMsg(`"${file.name}" aplicado como hero.`);
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Erro no upload.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="border-t border-border-subtle pt-4">
      <h3 className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500">
        Ou suba do computador
      </h3>
      <p className="text-fs-12 text-ink-700 mt-1 max-w-[60ch]">
        Envia um PNG, JPG ou WEBP (até 10 MB) do seu disco. Hospedamos no
        bucket e trocamos o hero direto.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="mt-2 h-10 px-4 rounded-md border-2 border-navy text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? "Enviando..." : hasHero ? "↑ Trocar arquivo" : "↑ Subir do computador"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChosen}
      />
      {msg && <p className="mt-2 text-fs-12 text-eco-green">{msg}</p>}
      {errMsg && <p className="mt-2 text-fs-12 text-alert-red">{errMsg}</p>}
    </div>
  );
}
