"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyAsArticleHero,
  applyVariation,
  generateVariations,
  refreshArticleHeroFromSource,
} from "@/lib/actions/media-studio";

type Props = {
  articleId: string;
  socialPostId: string;
  hasHeroImage: boolean;
  heroImageUrl: string | null;
  sourceImageUrl: string | null;
  sourceUrl: string | null;
  hasScoredOrigin: boolean;
};

type GenState =
  | { kind: "idle" }
  | { kind: "generating"; startedAt: number }
  | { kind: "ready"; variations: string[]; usedRedux: boolean }
  | { kind: "error"; message: string };

// VariationsGallery — escuta eventos `zb-empty-action` (vindo do
// EmptyCanvas e do botão "Gerar imagem com esses slots" do SlotStudio).
// Quando dispara `generate`, chama o modelo configurado no slot "image"
// via server action e mostra 4 thumbs. Click no thumb = aplica como
// media_url do post.
export function VariationsGallery({
  articleId,
  socialPostId,
  hasHeroImage,
  heroImageUrl,
  sourceImageUrl,
  sourceUrl,
  hasScoredOrigin,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<GenState>({ kind: "idle" });
  const [applying, setApplying] = useState<string | null>(null);
  const [appliedUrl, setAppliedUrl] = useState<string | null>(null);
  const [applyingAsHero, setApplyingAsHero] = useState<string | null>(null);
  const [appliedAsHeroUrl, setAppliedAsHeroUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pullState, setPullState] = useState<
    { kind: "idle" } | { kind: "pulling" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handlePullFromSource = useCallback(() => {
    setPullState({ kind: "pulling" });
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("article_id", articleId);
        await refreshArticleHeroFromSource(fd);
        // refreshArticleHeroFromSource revalida o path → o server component
        // re-renderiza com heroImageUrl novo. Não precisa setar state aqui.
        setPullState({ kind: "idle" });
      } catch (err) {
        setPullState({
          kind: "error",
          message: err instanceof Error ? err.message : "Falha ao buscar imagem.",
        });
      }
    });
  }, [articleId]);

  const trigger = useCallback(() => {
    setState({ kind: "generating", startedAt: Date.now() });
    startTransition(async () => {
      try {
        const result = await generateVariations(articleId, socialPostId);
        setState({
          kind: "ready",
          variations: result.variations,
          usedRedux: result.used_redux,
        });
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Erro ao gerar variações.",
        });
      }
    });
  }, [articleId, socialPostId]);

  // Escuta os 2 eventos que disparam geração: EmptyCanvas (action=generate)
  // e SlotStudio (mesmo evento). Outros (source/upload) ficam no MediaSourcePicker.
  useEffect(() => {
    function onAction(e: Event) {
      const detail = (e as CustomEvent<{ action?: string; socialPostId?: string }>).detail;
      if (!detail) return;
      if (detail.action !== "generate") return;
      if (detail.socialPostId && detail.socialPostId !== socialPostId) return;
      trigger();
    }
    window.addEventListener("zb-empty-action", onAction as EventListener);
    return () => window.removeEventListener("zb-empty-action", onAction as EventListener);
  }, [socialPostId, trigger]);

  const handleApply = useCallback(
    (mediaUrl: string) => {
      setApplying(mediaUrl);
      startTransition(async () => {
        try {
          await applyVariation(socialPostId, mediaUrl);
          setAppliedUrl(mediaUrl);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("zb-show-undo", {
                detail: {
                  action: "apply_variation",
                  socialPostId,
                  applied: mediaUrl,
                },
              }),
            );
          }
        } catch (err) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Erro ao aplicar.",
          });
        } finally {
          setApplying(null);
        }
      });
    },
    [socialPostId],
  );

  const handleApplyAsHero = useCallback(
    (mediaUrl: string) => {
      setApplyingAsHero(mediaUrl);
      startTransition(async () => {
        try {
          await applyAsArticleHero(articleId, mediaUrl);
          setAppliedAsHeroUrl(mediaUrl);
          router.refresh();
        } catch (err) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Erro ao aplicar no hero.",
          });
        } finally {
          setApplyingAsHero(null);
        }
      });
    },
    [articleId, router],
  );

  return (
    <section className="border-t border-border-subtle bg-white px-4 py-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
            Variações IA
          </p>
          <p className="font-display font-bold text-fs-13 text-navy mt-0.5 leading-tight">
            {state.kind === "ready"
              ? state.usedRedux
                ? "4 variações da imagem original"
                : "4 variações dos slots"
              : "4 variações pelo modelo configurado"}
          </p>
        </div>
        {state.kind !== "generating" && (
          <button
            type="button"
            onClick={trigger}
            disabled={isPending}
            className="h-8 px-3 rounded-md bg-navy text-zimba-gold text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold hover:text-navy disabled:opacity-50 transition-colors"
          >
            {state.kind === "ready" ? "↻ Refazer" : "✦ Gerar"}
          </button>
        )}
      </header>

      <ReferenceBar
        heroImageUrl={heroImageUrl}
        sourceImageUrl={sourceImageUrl}
        sourceUrl={sourceUrl}
        hasScoredOrigin={hasScoredOrigin}
        pullState={pullState}
        onPull={handlePullFromSource}
      />

      {state.kind === "idle" && (
        <p className="text-[11px] text-ink-500 leading-snug mt-2">
          {hasHeroImage
            ? "Vou usar a imagem acima como base e gerar 4 variações com seus slots."
            : "Sem imagem de referência — gero 4 variações do zero a partir do prompt dos slots."}
        </p>
      )}

      {state.kind === "generating" && <GeneratingSkeleton />}

      {state.kind === "error" && (
        <div className="rounded-md border border-alert-red/30 bg-alert-red/5 p-3 text-fs-12 text-alert-red space-y-2">
          <p className="font-bold">Falha ao gerar.</p>
          <p className="leading-snug">{state.message}</p>
          <button
            type="button"
            onClick={trigger}
            className="text-[11px] uppercase tracking-[0.22em] font-bold underline hover:no-underline"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {state.kind === "ready" && (
        <div className="grid grid-cols-2 gap-2">
          {state.variations.map((url, idx) => {
            const isApplying = applying === url;
            const isApplied = appliedUrl === url;
            const isApplyingHero = applyingAsHero === url;
            const isAppliedHero = appliedAsHeroUrl === url;
            return (
              <div
                key={url}
                className={
                  "group relative aspect-square rounded-md overflow-hidden border-2 transition-all " +
                  (isApplied
                    ? "border-eco-green ring-2 ring-eco-green/30"
                    : "border-border-subtle hover:border-zimba-gold")
                }
              >
                <button
                  type="button"
                  onClick={() => handleApply(url)}
                  disabled={isPending}
                  className="absolute inset-0 w-full h-full"
                  aria-label={`Aplicar variação ${idx + 1} no canal`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Variação ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
                <span className="absolute top-1 left-1 bg-navy/80 text-zimba-gold text-[9px] uppercase tracking-[0.2em] font-bold px-1.5 py-0.5 rounded-xs pointer-events-none">
                  {idx + 1}
                </span>

                {/* Botão "★ Hero" — top-right, sempre clicável quando idle */}
                {!isApplying && !isApplyingHero && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyAsHero(url);
                    }}
                    disabled={isPending}
                    className={
                      "absolute top-1 right-1 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[9px] uppercase tracking-[0.18em] font-bold transition-all " +
                      (isAppliedHero
                        ? "bg-zimba-gold text-navy"
                        : "bg-navy/80 text-zimba-gold opacity-0 group-hover:opacity-100 hover:bg-zimba-gold hover:text-navy")
                    }
                    title={
                      isAppliedHero
                        ? "Aplicado como capa da matéria"
                        : "Aplicar como capa da matéria (hero_image_url)"
                    }
                  >
                    ★ Hero
                  </button>
                )}

                {isApplying && (
                  <span className="absolute inset-0 bg-navy/60 flex items-center justify-center text-zimba-gold text-[10px] uppercase tracking-[0.22em] font-bold pointer-events-none">
                    aplicando…
                  </span>
                )}
                {isApplyingHero && !isApplying && (
                  <span className="absolute inset-0 bg-zimba-gold/30 flex items-center justify-center text-navy text-[10px] uppercase tracking-[0.22em] font-bold pointer-events-none">
                    aplicando hero…
                  </span>
                )}
                {isApplied && !isApplying && !isApplyingHero && (
                  <span className="absolute inset-0 bg-eco-green/15 flex items-center justify-center text-eco-green text-fs-20 font-bold pointer-events-none">
                    ✓
                  </span>
                )}
                {!isApplying && !isApplied && !isApplyingHero && (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/85 to-transparent text-zimba-gold text-[10px] uppercase tracking-[0.22em] font-bold py-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-center pointer-events-none">
                    aplicar no canal
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

type PullState =
  | { kind: "idle" }
  | { kind: "pulling" }
  | { kind: "error"; message: string };

function ReferenceBar({
  heroImageUrl,
  sourceImageUrl,
  sourceUrl,
  hasScoredOrigin,
  pullState,
  onPull,
}: {
  heroImageUrl: string | null;
  sourceImageUrl: string | null;
  sourceUrl: string | null;
  hasScoredOrigin: boolean;
  pullState: PullState;
  onPull: () => void;
}) {
  // Hero já está re-hospedado no nosso bucket — usa direto.
  if (heroImageUrl) {
    return (
      <div className="flex items-center gap-3 mb-3 p-2 rounded-md bg-eco-green/5 border border-eco-green/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImageUrl}
          alt="Imagem de referência atual"
          className="w-14 h-14 rounded-sm object-cover border border-border-subtle shrink-0"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-eco-green">
            Usando como referência
          </p>
          <p className="text-[11px] text-ink-700 leading-snug">
            A geração vai partir dessa foto + seus slots (image-to-image).
          </p>
        </div>
      </div>
    );
  }

  // Sem hero, mas tem origem rastreável — botão pra puxar.
  if (hasScoredOrigin) {
    return (
      <div className="mb-3 p-2 rounded-md bg-zimba-gold/10 border border-zimba-gold/40 space-y-2">
        <div className="flex items-start gap-3">
          {sourceImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sourceImageUrl}
              alt="Foto da fonte original"
              className="w-14 h-14 rounded-sm object-cover border border-border-subtle shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-14 h-14 rounded-sm bg-navy/5 border border-border-subtle shrink-0 flex items-center justify-center text-ink-400 text-fs-20">
              📷
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-navy">
              {sourceImageUrl ? "A fonte tem foto" : "Sem foto ainda"}
            </p>
            <p className="text-[11px] text-ink-700 leading-snug">
              {sourceImageUrl
                ? "Puxa pra cá pra usar como referência na geração."
                : "Tenta raspar a og:image da página da fonte agora."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onPull}
            disabled={pullState.kind === "pulling"}
            className="h-7 px-3 rounded-md bg-navy text-zimba-gold text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold hover:text-navy disabled:opacity-50 transition-colors"
          >
            {pullState.kind === "pulling" ? "Buscando..." : "↓ Trazer da fonte"}
          </button>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[10px] uppercase tracking-[0.22em] font-bold text-navy underline-offset-2 hover:underline"
            >
              Ver fonte ↗
            </a>
          )}
        </div>
        {pullState.kind === "error" && (
          <p className="text-[11px] text-alert-red leading-snug">{pullState.message}</p>
        )}
      </div>
    );
  }

  // Matéria criada manual — sem rastreio de origem.
  return (
    <div className="mb-3 p-2 rounded-md bg-off-white border border-border-subtle">
      <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500">
        Sem imagem de referência
      </p>
      <p className="text-[11px] text-ink-700 leading-snug">
        Matéria sem origem rastreável. A geração vai do zero pelo prompt dos slots.
      </p>
    </div>
  );
}

function GeneratingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-md bg-gradient-to-br from-navy/5 via-zimba-gold/10 to-navy/5 animate-pulse border border-border-subtle"
          />
        ))}
      </div>
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink-500 text-center">
        Gerando · ~6-12s
      </p>
    </div>
  );
}
