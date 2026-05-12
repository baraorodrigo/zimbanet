"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { fetchSourceImage, uploadMediaFromForm } from "@/lib/actions/media-studio";

type Props = {
  articleId: string;
  socialPostId: string;
  hasHeroImage: boolean;
  hasMedia: boolean;
};

// MediaSourcePicker — os 2 caminhos não-IA: "Da fonte" (puxa hero_image_url)
// e "Upload manual" (FormData).
// Escuta `zb-empty-action` pra disparar fluxo a partir do EmptyCanvas.
export function MediaSourcePicker({
  articleId,
  socialPostId,
  hasHeroImage,
  hasMedia,
}: Props) {
  const [busy, setBusy] = useState<"source" | "upload" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function clearStatus() {
    setMsg(null);
    setErrMsg(null);
  }

  function handleSource() {
    if (!hasHeroImage) {
      setErrMsg("A matéria ainda não tem imagem de origem (hero_image_url).");
      return;
    }
    clearStatus();
    setBusy("source");
    startTransition(async () => {
      try {
        await fetchSourceImage(articleId, socialPostId);
        setMsg("Imagem da fonte aplicada.");
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Erro ao buscar fonte.");
      } finally {
        setBusy(null);
      }
    });
  }

  function handleUploadClick() {
    clearStatus();
    fileInputRef.current?.click();
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reescolher mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrMsg("Só aceitamos imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrMsg("Imagem maior que 10 MB.");
      return;
    }
    setBusy("upload");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("social_post_id", socialPostId);
        fd.set("file", file);
        await uploadMediaFromForm(fd);
        setMsg(`"${file.name}" aplicado.`);
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Erro no upload.");
      } finally {
        setBusy(null);
      }
    });
  }

  // Escuta os atalhos do EmptyCanvas
  useEffect(() => {
    function onAction(e: Event) {
      const detail = (e as CustomEvent<{ action?: string; socialPostId?: string }>).detail;
      if (!detail) return;
      if (detail.socialPostId && detail.socialPostId !== socialPostId) return;
      if (detail.action === "source") handleSource();
      else if (detail.action === "upload") handleUploadClick();
    }
    window.addEventListener("zb-empty-action", onAction as EventListener);
    return () => window.removeEventListener("zb-empty-action", onAction as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialPostId, hasHeroImage]);

  return (
    <section className="px-4 py-3 bg-off-white border-t border-border-subtle">
      <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500 mb-2">
        Outras origens
      </p>
      <div className="grid grid-cols-2 gap-2">
        <SourceButton
          icon="⤓"
          label="Da fonte"
          sub={hasHeroImage ? "puxar imagem do RSS" : "matéria sem hero"}
          onClick={handleSource}
          disabled={!hasHeroImage || isPending}
          busy={busy === "source"}
        />
        <SourceButton
          icon="↑"
          label={hasMedia ? "Trocar arquivo" : "Upload manual"}
          sub="enviar do computador"
          onClick={handleUploadClick}
          disabled={isPending}
          busy={busy === "upload"}
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChosen}
      />
      {msg && <p className="mt-2 text-[11px] text-eco-green">{msg}</p>}
      {errMsg && <p className="mt-2 text-[11px] text-alert-red">{errMsg}</p>}
    </section>
  );
}

function SourceButton({
  icon,
  label,
  sub,
  onClick,
  disabled,
  busy,
}: {
  icon: string;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-1 rounded-md border border-border-subtle bg-white px-3 py-2.5 text-left hover:border-zimba-blue hover:text-zimba-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <span className="flex items-center gap-2 text-fs-14 font-display font-bold text-navy group-hover:text-zimba-blue">
        <span aria-hidden className="text-fs-16">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-ink-500">
        {busy ? "enviando..." : sub}
      </span>
    </button>
  );
}
