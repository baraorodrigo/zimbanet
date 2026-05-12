"use client";

import { useState } from "react";
import Icon from "@/components/icon";

type Props = {
  title: string;
  url: string;
};

export default function ShareButtons({ title, url }: Props) {
  const [copied, setCopied] = useState(false);

  const text = title;
  const enc = encodeURIComponent;
  const wa = `https://wa.me/?text=${enc(`${text} — ${url}`)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
  const tg = `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-6">
      <span className="font-sans text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mr-2">
        Compartilhar:
      </span>

      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no WhatsApp"
        className="inline-flex items-center gap-1.5 rounded-xs border border-border-subtle bg-white px-3 py-1.5 font-sans text-fs-12 font-semibold text-navy/80 hover:bg-eco-green hover:text-white hover:border-eco-green transition-colors"
      >
        <Icon name="whatsapp" size={14} />
        WhatsApp
      </a>

      <a
        href={fb}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no Facebook"
        className="inline-flex items-center gap-1.5 rounded-xs border border-border-subtle bg-white px-3 py-1.5 font-sans text-fs-12 font-semibold text-navy/80 hover:bg-zimba-blue hover:text-white hover:border-zimba-blue transition-colors"
      >
        <Icon name="facebook" size={14} />
        Facebook
      </a>

      <a
        href={tg}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no Telegram"
        className="inline-flex items-center gap-1.5 rounded-xs border border-border-subtle bg-white px-3 py-1.5 font-sans text-fs-12 font-semibold text-navy/80 hover:bg-navy hover:text-zimba-gold hover:border-navy transition-colors"
      >
        <Icon name="telegram" size={14} />
        Telegram
      </a>

      <button
        type="button"
        onClick={copyLink}
        aria-label="Copiar link da matéria"
        className={`inline-flex items-center gap-1.5 rounded-xs border px-3 py-1.5 font-sans text-fs-12 font-semibold transition-colors ${
          copied
            ? "border-eco-green bg-eco-green text-white"
            : "border-border-subtle bg-white text-navy/80 hover:bg-zimba-gold hover:text-navy hover:border-zimba-gold"
        }`}
      >
        <Icon name={copied ? "check" : "link"} size={14} />
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
