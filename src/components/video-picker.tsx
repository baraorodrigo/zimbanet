"use client";

// VideoPicker — irmão do ImagePicker pra mídia de vídeo. Suporta dois caminhos:
//   1. Upload de arquivo (.mp4/.webm/.mov, máx 50 MB) → /lib/actions/uploads
//   2. URL externa (YouTube/Reels/TikTok ou direct .mp4 já hospedado)
//
// Preview:
//   - URL self-hosted (.mp4/.webm/.mov ou Supabase Storage) → <video> nativo
//   - URL de plataforma → label do provider (iframe seria pesado pro form)

import { useRef, useState, useTransition } from "react";
import { uploadVideo, type UploadResult } from "@/lib/actions/uploads";
import { parseVideoUrl } from "./video-embed";

export type VideoPickerProps = {
  name: string;
  defaultValue?: string | null;
  scope?: string;
  label?: string;
  hint?: string;
};

function isSelfHostedVideo(url: string): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

export function VideoPicker({
  name,
  defaultValue = "",
  scope = "misc",
  label = "Vídeo",
  hint,
}: VideoPickerProps) {
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
      const r: UploadResult = await uploadVideo(fd);
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
  const parsed = hasValue ? parseVideoUrl(value) : null;
  const selfHosted = hasValue && isSelfHostedVideo(value);
  const providerLabel = parsed
    ? parsed.provider === "youtube"
      ? "YouTube"
      : parsed.provider === "instagram"
        ? "Instagram"
        : parsed.provider === "tiktok"
          ? "TikTok"
          : null
    : null;

  return (
    <div className="space-y-3">
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
      <div className="aspect-[16/9] relative rounded-md border-2 border-dashed border-border-subtle bg-off-white overflow-hidden">
        {hasValue ? (
          selfHosted ? (
            <video
              src={value}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-contain bg-black"
              onError={() => setErr("Não consegui carregar esse vídeo.")}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-navy/5">
              <span className="text-fs-30 mb-2" aria-hidden>
                ▶
              </span>
              <p className="font-display font-black text-fs-14 text-navy">
                {providerLabel
                  ? `Vídeo no ${providerLabel}`
                  : "Link externo salvo"}
              </p>
              <p className="text-fs-11 text-ink-500 mt-1 break-all max-w-[80%]">
                {value}
              </p>
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div>
              <p className="font-display font-black text-fs-15 text-ink-500">
                Sem vídeo ainda
              </p>
              <p className="text-fs-12 text-ink-400 mt-1 max-w-[34ch] mx-auto">
                Sobe um arquivo (.mp4, .webm ou .mov, até 50 MB) ou cola um link do
                YouTube, Reels ou TikTok.
              </p>
            </div>
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 bg-navy/70 text-zimba-gold flex items-center justify-center text-[10px] uppercase tracking-[0.28em] font-bold">
            Enviando vídeo…
          </div>
        )}
      </div>

      {err && (
        <p className="text-fs-12 text-alert-red border border-alert-red/30 bg-alert-red/5 px-3 py-2 rounded">
          {err}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <label className="h-10 px-4 inline-flex items-center rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold hover:text-navy transition-colors cursor-pointer">
          {hasValue ? "Trocar arquivo" : "🎬 Escolher do disco"}
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="sr-only"
          />
        </label>

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
            placeholder="ou cole o link (YouTube, Reels, TikTok)…"
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
      </div>
    </div>
  );
}
