"use client";

// ImagePicker — widget reutilizável de seleção de imagem pra todas as
// áreas de criação de conteúdo (admin matérias/nova, bazar/novo, mural).
// Equivale ao media-source-picker do Estúdio social, mas leve, sem
// dependência de article_id (a matéria/anúncio ainda não existe).
//
// Caminhos de entrada:
//   1. Upload de arquivo (drag/drop ou click) → /lib/actions/uploads
//   2. URL externa (admin cola, baixa em background — opcional via prop)
//
// Saída: input hidden com `name` definido pelo caller, pra o form pai
// submeter junto. Preview live sempre que houver value.

import { useRef, useState, useTransition } from "react";
import { uploadImage, type UploadResult } from "@/lib/actions/uploads";

export type ImagePickerProps = {
  /** Nome do input hidden — vai no FormData do form pai. Ex: "hero_image_url". */
  name: string;
  /** Valor inicial (URL existente). */
  defaultValue?: string | null;
  /** Scope do upload — vira segmento do path no bucket. Ex: "article", "bazar". */
  scope?: string;
  /** Label do campo no contexto do form. */
  label?: string;
  /** Texto auxiliar. */
  hint?: string;
  /** Aspect ratio do preview. */
  aspect?: "video" | "square" | "wide";
  /** Mostra também campo de URL externa. Default true. */
  allowUrl?: boolean;
};

const ASPECT_CLS = {
  video: "aspect-[16/9]",
  square: "aspect-square",
  wide: "aspect-[21/9]",
} as const;

export function ImagePicker({
  name,
  defaultValue = "",
  scope = "misc",
  label = "Imagem",
  hint,
  aspect = "video",
  allowUrl = true,
}: ImagePickerProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setErr(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("scope", scope);
    startTransition(async () => {
      const r: UploadResult = await uploadImage(fd);
      if (r.ok) {
        setValue(r.url);
      } else {
        setErr(r.error);
      }
    });
  }

  function applyUrl() {
    const u = urlInput.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) {
      setErr("URL precisa começar com http:// ou https://.");
      return;
    }
    setErr(null);
    setValue(u);
    setUrlInput("");
  }

  function clearValue() {
    setValue("");
    setErr(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const hasValue = !!value;

  return (
    <div className="space-y-3">
      {/* Hidden — é isso que o form pai consome */}
      <input type="hidden" name={name} value={value} />

      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500">
            {label}
          </span>
          {hint && <p className="text-fs-12 text-ink-500 mt-1">{hint}</p>}
        </div>
        {hasValue && (
          <button
            type="button"
            onClick={clearValue}
            className="text-[10px] uppercase tracking-[0.22em] font-bold text-alert-red hover:underline"
          >
            Remover
          </button>
        )}
      </div>

      {/* Preview */}
      <div
        className={`${ASPECT_CLS[aspect]} relative rounded-md border-2 border-dashed border-border-subtle bg-off-white overflow-hidden`}
      >
        {hasValue ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Pré-visualização"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setErr("Não consegui carregar essa imagem.")}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div>
              <p className="font-display font-black text-fs-15 text-ink-500">
                Sem imagem ainda
              </p>
              <p className="text-fs-12 text-ink-400 mt-1 max-w-[28ch] mx-auto">
                Solte um arquivo aqui, escolha do disco{allowUrl ? " ou cole uma URL" : ""}.
              </p>
            </div>
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 bg-navy/70 text-zimba-gold flex items-center justify-center text-[10px] uppercase tracking-[0.28em] font-bold">
            Enviando…
          </div>
        )}
      </div>

      {err && (
        <p className="text-fs-12 text-alert-red border border-alert-red/30 bg-alert-red/5 px-3 py-2 rounded">
          {err}
        </p>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <label className="h-10 px-4 inline-flex items-center rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold hover:text-navy transition-colors cursor-pointer">
          {hasValue ? "Trocar arquivo" : "📁 Escolher do disco"}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="sr-only"
          />
        </label>

        {allowUrl && (
          <div className="flex flex-1 min-w-[200px] gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyUrl();
                }
              }}
              placeholder="ou cole uma URL https://…"
              className="flex-1 h-10 px-3 rounded-md border-2 border-border-subtle font-mono text-fs-12 focus:outline-none focus:border-navy bg-off-white"
            />
            <button
              type="button"
              onClick={applyUrl}
              disabled={!urlInput.trim()}
              className="h-10 px-4 rounded-md border-2 border-navy text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Usar URL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
