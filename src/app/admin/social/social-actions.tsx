"use client";

import { useState } from "react";

// Copiar legenda (caption + hashtags) pro clipboard — o editor cola direto no
// app da rede. Parte do fluxo "manual honesto": o ZIMBANET prepara, você posta.
export function CopyCaptionButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text.trim()) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard bloqueado — ignora */
        }
      }}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-fs-12 font-bold transition-colors ${
        copied
          ? "bg-eco-green text-white"
          : "border border-border-subtle text-navy hover:border-navy"
      }`}
    >
      {copied ? "✓ copiada" : "Copiar legenda"}
    </button>
  );
}
