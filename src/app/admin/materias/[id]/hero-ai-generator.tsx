"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateHeroVariations,
  applyAsArticleHero,
} from "@/lib/actions/media-studio";

type Props = {
  articleId: string;
  articleTitle: string;
  articleLede: string | null;
  hasHero: boolean;
};

function suggestPrompt(title: string, lede: string | null): string {
  const bits = [title.trim()];
  if (lede && lede.trim()) bits.push(lede.trim());
  return [
    `Cena documental retratando: ${bits.join(" — ")}.`,
    "Fotografia editorial, plano aberto, luz natural, gente real do litoral catarinense.",
    "Estética ZIMBANET: nostalgia moderna, flat, alta densidade editorial.",
    "Sem texto sobreposto, sem logos, sem marcas d'água.",
  ].join(" ");
}

export function HeroAIGenerator({
  articleId,
  articleTitle,
  articleLede,
  hasHero,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState(() => suggestPrompt(articleTitle, articleLede));
  const [variations, setVariations] = useState<string[]>([]);
  const [usedSource, setUsedSource] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyingUrl, setApplyingUrl] = useState<string | null>(null);
  const [appliedUrl, setAppliedUrl] = useState<string | null>(null);

  function fireGenerate() {
    setError(null);
    setAppliedUrl(null);
    startTransition(async () => {
      const res = await generateHeroVariations(articleId, prompt);
      if (!res.ok) {
        setError(res.error);
        setVariations([]);
        return;
      }
      setVariations(res.urls);
      setUsedSource(res.used_source);
      setProvider(`${res.provider}/${res.modelId}`);
    });
  }

  function fireApply(url: string) {
    setError(null);
    setApplyingUrl(url);
    startTransition(async () => {
      try {
        await applyAsArticleHero(articleId, url);
        setAppliedUrl(url);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setApplyingUrl(null);
      }
    });
  }

  function resetSuggestion() {
    setPrompt(suggestPrompt(articleTitle, articleLede));
  }

  return (
    <div className="border-t border-border-subtle pt-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="text-[10px] uppercase tracking-[0.24em] font-bold text-ink-500">
          ✨ Gerar com IA — 3 variações 16:9
        </h3>
        <button
          type="button"
          onClick={resetSuggestion}
          disabled={pending}
          className="text-fs-11 text-ink-400 hover:text-navy underline-offset-2 hover:underline"
        >
          ↻ usar sugestão do título
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={pending}
        rows={4}
        className="mt-2 w-full px-3 py-2 rounded-md border-2 border-border-subtle text-fs-13 text-navy focus:outline-none focus:border-navy bg-off-white resize-y"
      />
      <p className="text-fs-11 text-ink-400 mt-1">
        {prompt.length} chars · descreva sujeito, cena, atmosfera. Sem texto na imagem.
        {hasHero && (
          <span className="ml-1 text-zimba-gold">
            · vai usar o hero atual como referência (image-to-image)
          </span>
        )}
      </p>

      <button
        type="button"
        onClick={fireGenerate}
        disabled={pending || prompt.trim().length < 8}
        className="mt-3 h-10 px-4 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending && variations.length === 0 ? "Gerando 3 variações…" : "✨ Gerar 3 variações"}
      </button>

      {error && (
        <div className="mt-3 rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {error}
        </div>
      )}

      {variations.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-2">
            Escolha uma — clica e vira o hero da matéria
            {provider && (
              <span className="ml-2 normal-case tracking-normal text-ink-400 font-mono text-fs-11">
                {provider}
                {usedSource && " · i2i"}
              </span>
            )}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {variations.map((url) => {
              const isApplying = applyingUrl === url;
              const isApplied = appliedUrl === url;
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => fireApply(url)}
                  disabled={pending}
                  className={`relative aspect-[16/9] overflow-hidden rounded-md border-2 transition-colors ${
                    isApplied
                      ? "border-eco-green"
                      : "border-border-subtle hover:border-navy"
                  }`}
                  title={isApplied ? "Aplicada como hero" : "Clique pra aplicar como hero"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Variação gerada"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {isApplying && (
                    <div className="absolute inset-0 bg-navy/70 flex items-center justify-center text-zimba-gold text-fs-11 font-bold uppercase tracking-[0.18em]">
                      aplicando…
                    </div>
                  )}
                  {isApplied && (
                    <div className="absolute inset-x-0 bottom-0 bg-eco-green text-white text-fs-11 font-bold uppercase tracking-[0.18em] py-1 text-center">
                      ✓ hero
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={fireGenerate}
            disabled={pending}
            className="mt-3 h-9 px-3 rounded-md border border-border-subtle text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold hover:border-navy hover:text-navy transition-colors disabled:opacity-50"
          >
            {pending ? "Gerando…" : "↻ gerar de novo (mesma prompt)"}
          </button>
        </div>
      )}
    </div>
  );
}
