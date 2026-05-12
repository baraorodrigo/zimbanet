"use client";

import { useState, useTransition } from "react";
import { autoAdaptCaptionsToAllChannels } from "@/lib/actions/auto-adapt";

type Props = {
  socialPostId: string;
  channelLabel: string;
};

type Result = {
  adapted: Array<{ socialPostId: string; channel: string; caption: string }>;
};

const CHANNEL_LABEL: Record<string, string> = {
  instagram_feed: "IG feed",
  instagram_story: "IG stories",
  instagram_carousel: "IG carrossel",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  push: "Push",
};

// AutoAdaptButton — pega a caption do post atual e propaga adaptada
// pros outros canais do mesmo article (modelo do slot text_fast).
export function AutoAdaptButton({ socialPostId, channelLabel }: Props) {
  const [result, setResult] = useState<Result | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setErrMsg(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await autoAdaptCaptionsToAllChannels(socialPostId);
        setResult(r);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zb-show-undo", {
              detail: { action: "auto_adapt", socialPostId, count: r.adapted.length },
            }),
          );
        }
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Erro na adaptação.");
      }
    });
  }

  return (
    <div className="rounded-md border border-zimba-gold/40 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold">
            Auto-adapt · Claude Haiku
          </p>
          <p className="font-display font-bold text-fs-13 text-navy mt-0.5 leading-tight">
            Espalhar caption pros outros canais
          </p>
          <p className="text-[11px] text-ink-500 mt-0.5">
            Fonte: {channelLabel}. Tom é ajustado por canal (IG, FB, WA, Telegram, Push).
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          className="shrink-0 h-9 px-3 rounded-md bg-zimba-gold text-navy text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold disabled:opacity-50 transition-colors"
        >
          {isPending ? "adaptando..." : "✶ Adaptar"}
        </button>
      </div>

      {errMsg && (
        <p className="mt-2 text-[11px] text-alert-red leading-snug">{errMsg}</p>
      )}

      {result && (
        <div className="mt-3 space-y-1.5">
          {result.adapted.length === 0 ? (
            <p className="text-[11px] text-ink-500">
              Nada pra adaptar — todos os outros canais já foram publicados.
            </p>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-eco-green">
                ✓ {result.adapted.length} canal{result.adapted.length > 1 ? "is" : ""} atualizado
                {result.adapted.length > 1 ? "s" : ""}
              </p>
              <ul className="space-y-1">
                {result.adapted.map((a) => (
                  <li
                    key={a.socialPostId}
                    className="text-[11px] text-ink-700 leading-snug border-l-2 border-zimba-gold/40 pl-2"
                  >
                    <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-blue mr-1">
                      {CHANNEL_LABEL[a.channel] ?? a.channel}:
                    </span>
                    <span className="text-ink-700">{a.caption.slice(0, 110)}{a.caption.length > 110 ? "…" : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
