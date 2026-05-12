"use client";

// Reframer do hero — mesma mecânica do CanvasReframer (drag-to-pan,
// scroll-to-zoom, cover/contain), mas salva em `articles.hero_image_url`
// via uploadArticleHeroFromForm em vez de mexer num social_post.
//
// Output 1600×1000 (16:10) — é o crop dominante (home main). Os outros
// lugares onde o hero aparece (slug page 16:9, cards 1:1) crocam por
// cima dele com object-cover, mantendo o centro do enquadramento.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadArticleHeroFromForm } from "@/lib/actions/media-studio";

type Props = {
  articleId: string;
  heroImageUrl: string;
  heroImageAlt: string | null;
};

type Transform = { tx: number; ty: number; scale: number };
type FitMode = "cover" | "contain";

const IDENTITY: Transform = { tx: 0, ty: 0, scale: 1 };
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const TARGET = { w: 1600, h: 1000 }; // 16:10

export function HeroReframer({ articleId, heroImageUrl, heroImageAlt }: Props) {
  const router = useRouter();
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [fitMode, setFitMode] = useState<FitMode>("cover");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [imgLoaded, setImgLoaded] = useState(false);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const naturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [base, setBase] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; tx0: number; ty0: number }>({
    active: false,
    sx: 0,
    sy: 0,
    tx0: 0,
    ty0: 0,
  });

  const recomputeBase = useCallback(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !img.naturalWidth) return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const ar = img.naturalWidth / img.naturalHeight;
    const frameAr = fw / fh;
    let bw: number;
    let bh: number;
    const wider = ar > frameAr;
    if (fitMode === "cover" ? wider : !wider) {
      bh = fh;
      bw = bh * ar;
    } else {
      bw = fw;
      bh = bw / ar;
    }
    setBase({ w: bw, h: bh });
    naturalRef.current = { w: img.naturalWidth, h: img.naturalHeight };
    setImgLoaded(true);
  }, [fitMode]);

  useEffect(() => {
    function onResize() {
      recomputeBase();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recomputeBase]);

  useEffect(() => {
    setTransform(IDENTITY);
    setDirty(false);
    setImgLoaded(false);
    setMsg(null);
    setErrMsg(null);
  }, [heroImageUrl, articleId]);

  useEffect(() => {
    setTransform(IDENTITY);
    setDirty(true);
    recomputeBase();
  }, [fitMode, recomputeBase]);

  function onImgLoad() {
    recomputeBase();
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      tx0: transform.tx,
      ty0: transform.ty,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setTransform((t) => ({ ...t, tx: dragRef.current.tx0 + dx, ty: dragRef.current.ty0 + dy }));
    setDirty(true);
  }
  function onPointerUp(e: React.PointerEvent) {
    dragRef.current.active = false;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setTransform((t) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * (1 + delta)));
      return { ...t, scale: next };
    });
    setDirty(true);
  }

  function reset() {
    setTransform(IDENTITY);
    setDirty(false);
    setMsg(null);
    setErrMsg(null);
  }

  const save = useCallback(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !img.naturalWidth) return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const bw = base.w;
    const bh = base.h;
    if (!bw || !bh) return;

    const s = transform.scale;
    const cx = (fw - bw) / 2;
    const cy = (fh - bh) / 2;
    const imgFrameX = cx + transform.tx;
    const imgFrameY = cy + transform.ty;
    const imgFrameW = bw * s;
    const imgFrameH = bh * s;

    const kx = TARGET.w / fw;
    const ky = TARGET.h / fh;

    const out = document.createElement("canvas");
    out.width = TARGET.w;
    out.height = TARGET.h;
    const ctx = out.getContext("2d");
    if (!ctx) {
      setErrMsg("Navegador não suporta canvas 2D.");
      return;
    }
    ctx.fillStyle = "#0D1B2A";
    ctx.fillRect(0, 0, TARGET.w, TARGET.h);
    try {
      ctx.drawImage(
        img,
        0,
        0,
        naturalRef.current.w,
        naturalRef.current.h,
        imgFrameX * kx,
        imgFrameY * ky,
        imgFrameW * kx,
        imgFrameH * ky,
      );
    } catch (err) {
      setErrMsg("Não consegui ler a imagem. CORS?");
      console.error(err);
      return;
    }

    setBusy(true);
    setMsg("salvando capa…");
    setErrMsg(null);
    out.toBlob(
      (blob) => {
        if (!blob) {
          setBusy(false);
          setErrMsg("Falha ao gerar PNG.");
          return;
        }
        const file = new File([blob], `hero-reframe-${Date.now()}.png`, { type: "image/png" });
        const fd = new FormData();
        fd.set("article_id", articleId);
        fd.set("file", file);
        startTransition(async () => {
          try {
            await uploadArticleHeroFromForm(fd);
            setMsg("✓ capa atualizada");
            setDirty(false);
            router.refresh();
          } catch (err) {
            setErrMsg(err instanceof Error ? err.message : "erro no upload");
            setMsg(null);
          } finally {
            setBusy(false);
          }
        });
      },
      "image/png",
      0.95,
    );
  }, [router, articleId, transform, base]);

  const imgWidth = base.w || 0;
  const imgHeight = base.h || 0;

  return (
    <div className="mx-auto max-w-[720px]">
      <div
        ref={frameRef}
        className={`relative aspect-[16/10] rounded-lg overflow-hidden border border-border-subtle shadow-sm bg-navy select-none ${
          dragRef.current.active ? "cursor-grabbing" : "cursor-grab"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        title="Arraste pra reenquadrar · scroll = zoom"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={heroImageUrl}
          alt={heroImageAlt ?? "Capa da matéria"}
          crossOrigin="anonymous"
          onLoad={onImgLoad}
          draggable={false}
          style={{
            position: "absolute",
            left: imgLoaded ? `${(frameRef.current?.clientWidth ?? 0) / 2 - imgWidth / 2}px` : 0,
            top: imgLoaded ? `${(frameRef.current?.clientHeight ?? 0) / 2 - imgHeight / 2}px` : 0,
            width: imgLoaded ? `${imgWidth}px` : "100%",
            height: imgLoaded ? `${imgHeight}px` : "100%",
            transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
            transformOrigin: "center center",
            willChange: "transform",
            objectFit: imgLoaded ? undefined : "cover",
            pointerEvents: "none",
          }}
        />

        <div className="pointer-events-none absolute inset-0 ring-1 ring-zimba-gold/50 ring-inset" />

        {!dirty && imgLoaded && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 bg-navy/80 text-zimba-gold text-[10px] uppercase tracking-[0.22em] font-bold px-2 py-1 rounded-xs">
            Arraste · scroll = zoom
          </div>
        )}

        <div
          className="absolute left-2 right-2 bottom-2 z-10"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="rounded-md bg-navy/85 backdrop-blur-sm shadow-z-3 p-2 flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Modo de enquadramento"
              className="inline-flex rounded-sm overflow-hidden border border-zimba-gold/30"
            >
              <button
                type="button"
                onClick={() => setFitMode("cover")}
                disabled={busy || isPending}
                className={`h-7 px-2 text-[9px] uppercase tracking-[0.2em] font-bold transition-colors ${
                  fitMode === "cover"
                    ? "bg-zimba-gold text-navy"
                    : "text-zimba-gold/70 hover:text-zimba-gold"
                }`}
                title="Preenche o quadro inteiro · pode cortar bordas"
              >
                ▣ Cobrir
              </button>
              <button
                type="button"
                onClick={() => setFitMode("contain")}
                disabled={busy || isPending}
                className={`h-7 px-2 text-[9px] uppercase tracking-[0.2em] font-bold border-l border-zimba-gold/30 transition-colors ${
                  fitMode === "contain"
                    ? "bg-zimba-gold text-navy"
                    : "text-zimba-gold/70 hover:text-zimba-gold"
                }`}
                title="Foto inteira cabe dentro · fundo navy preenche as bordas"
              >
                ⊡ Caber
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
              <span aria-hidden className="text-[9px] uppercase tracking-[0.18em] font-bold text-zimba-gold/70">
                zoom
              </span>
              <input
                type="range"
                aria-label="Zoom"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={0.05}
                value={transform.scale}
                onChange={(e) => {
                  setTransform((t) => ({ ...t, scale: Number(e.target.value) }));
                  setDirty(true);
                }}
                className="flex-1 accent-zimba-gold"
                disabled={busy || isPending}
              />
              <span className="font-mono text-[10px] text-zimba-gold/80 w-9 text-right tabular-nums">
                {transform.scale.toFixed(2)}×
              </span>
            </div>

            <button
              type="button"
              onClick={reset}
              disabled={!dirty || busy || isPending}
              className="h-7 w-7 rounded-sm border border-zimba-gold/30 text-zimba-gold/80 text-fs-12 inline-flex items-center justify-center hover:bg-zimba-gold hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Resetar enquadramento"
              aria-label="Resetar enquadramento"
            >
              ↺
            </button>

            <button
              type="button"
              onClick={save}
              disabled={!dirty || busy || isPending}
              className="h-7 px-3 rounded-sm bg-eco-green text-white text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-eco-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              title={`Gera PNG ${TARGET.w}×${TARGET.h} e substitui a capa do portal`}
            >
              ✓ Salvar capa
            </button>
          </div>
        </div>

        {busy && (
          <div className="absolute inset-0 bg-navy/60 flex items-center justify-center text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold z-20">
            {msg ?? "processando…"}
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] text-ink-400">
        Output {TARGET.w}×{TARGET.h} (16:10) · home + cards usam essa foto · slug page corta em 16:9 mantendo o centro.
      </p>

      {msg && !errMsg && <p className="mt-1 text-[11px] text-eco-green">{msg}</p>}
      {errMsg && <p className="mt-1 text-[11px] text-alert-red">{errMsg}</p>}
    </div>
  );
}
