"use client";

// Reframer interativo — substitui o preview estático do CanvasStage por
// um cropper drag-to-pan + scroll-to-zoom. O quadro fica travado no
// aspect-ratio do formato do post (1:1 feed, 9:16 stories, etc), e a
// imagem corre por dentro até o admin escolher o enquadramento.
//
// Quando o admin clica "Salvar enquadramento", desenhamos o recorte
// num canvas offscreen no tamanho nativo do formato (ex.: 1080×1920),
// produzimos um Blob PNG e reusamos `uploadMediaFromForm` — mesma
// pipeline do upload manual: vai pro bucket, vira o novo `media_url`
// do post, status volta pra "ready".
//
// CORS: dependemos do Supabase Storage devolver `Access-Control-Allow-
// Origin: *` em bucket público (que é o padrão). Se a imagem vier
// tainted (improvável), `canvas.toBlob` lança SecurityError e a gente
// mostra fallback sugerindo re-upload.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearPostMedia, uploadMediaFromForm } from "@/lib/actions/media-studio";

type Props = {
  socialPostId: string;
  mediaUrl: string;
  format: string;
  channelLabel: string;
};

// Tamanho-alvo de saída por formato (px). Mantém alinhado com o que
// o pipeline social espera nativamente.
function targetSize(format: string): { w: number; h: number } {
  switch (format) {
    case "story_1080x1920":
      return { w: 1080, h: 1920 };
    case "banner_1200x630":
      return { w: 1200, h: 630 };
    case "card_1080":
    case "carousel_slide":
    default:
      return { w: 1080, h: 1080 };
  }
}

function frameAspectClass(format: string): string {
  switch (format) {
    case "story_1080x1920":
      return "aspect-[9/16]";
    case "banner_1200x630":
      return "aspect-[40/21]";
    case "card_1080":
    case "carousel_slide":
    default:
      return "aspect-square";
  }
}

function frameMaxClass(format: string): string {
  switch (format) {
    case "story_1080x1920":
      return "max-w-[360px]";
    case "banner_1200x630":
      return "max-w-[640px]";
    default:
      return "max-w-[480px]";
  }
}

type Transform = { tx: number; ty: number; scale: number };
type FitMode = "cover" | "contain";

const IDENTITY: Transform = { tx: 0, ty: 0, scale: 1 };
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

export function CanvasReframer({ socialPostId, mediaUrl, format, channelLabel }: Props) {
  const router = useRouter();
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [fitMode, setFitMode] = useState<FitMode>("cover");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Dispara um evento que VariationsGallery/MediaSourcePicker escutam
  // (mesma plumbing do EmptyCanvas). Centraliza "trocar imagem" no
  // próprio canvas em vez de pulverizar nos 3 cantos do painel.
  function dispatchAction(action: "generate" | "upload" | "source") {
    setMenuOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("zb-empty-action", {
          detail: { action, socialPostId },
        }),
      );
    }
  }

  function fireClear() {
    setMenuOpen(false);
    if (!confirm("Apagar a imagem deste canal? Legenda e hashtags ficam.")) return;
    setBusy(true);
    setMsg("apagando…");
    setErrMsg(null);
    startTransition(async () => {
      try {
        await clearPostMedia(socialPostId);
        setMsg("✓ imagem apagada");
        router.refresh();
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "erro ao apagar");
        setMsg(null);
      } finally {
        setBusy(false);
      }
    });
  }

  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Tamanho natural (px reais) da imagem fonte — preenchido no onLoad.
  const naturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  // Posição base (sem transform): a imagem renderiza no modo (cover/contain).
  // Vira state — a UI precisa re-renderizar quando muda o modo.
  const [base, setBase] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Mouse drag state
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; tx0: number; ty0: number }>({
    active: false,
    sx: 0,
    sy: 0,
    tx0: 0,
    ty0: 0,
  });

  const aspect = frameAspectClass(format);
  const maxCls = frameMaxClass(format);
  const target = targetSize(format);

  // Calcula a dimensão base da imagem (em CSS px) de acordo com o modo:
  //   cover  → preenche o frame, pode passar dos limites (corte permitido)
  //   contain → cabe inteira dentro do frame, fundo navy preenche o resto
  // Esse é o ponto zero do transform.
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
      // cover + imagem mais larga: trava altura · contain + imagem mais alta: trava altura
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

  // Quando troca de mediaUrl (ex.: usuário aplicou variação nova),
  // reseta o transform.
  useEffect(() => {
    setTransform(IDENTITY);
    setDirty(false);
    setImgLoaded(false);
    setMsg(null);
    setErrMsg(null);
  }, [mediaUrl, socialPostId]);

  // Quando troca o modo (Cobrir ↔ Caber), recalcula base e reseta transform.
  useEffect(() => {
    setTransform(IDENTITY);
    setDirty(true);
    recomputeBase();
  }, [fitMode, recomputeBase]);

  function onImgLoad() {
    recomputeBase();
  }

  // Drag pan
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

  // Wheel zoom (ancorado no centro do frame pra UX previsível)
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

  // Constrói o canvas final e dispara upload via Server Action.
  // Abordagem universal: desenha a imagem INTEIRA escalada e posicionada
  // no canvas-alvo. drawImage clipa o que sair fora — então funciona pros
  // dois modos sem código separado:
  //   cover: imagem é maior que o frame, partes ficam fora → clipadas
  //   contain: imagem cabe inteira no frame → fundo navy aparece nas bordas
  const save = useCallback(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !img.naturalWidth) return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const bw = base.w;
    const bh = base.h;
    if (!bw || !bh) return;

    // Posição/tamanho da imagem em CSS px do frame:
    const s = transform.scale;
    const cx = (fw - bw) / 2;
    const cy = (fh - bh) / 2;
    const imgFrameX = cx + transform.tx;
    const imgFrameY = cy + transform.ty;
    const imgFrameW = bw * s;
    const imgFrameH = bh * s;

    // Mapeia frame px → target canvas px (mantendo proporção, frame e
    // target têm o mesmo aspect ratio).
    const kx = target.w / fw;
    const ky = target.h / fh;

    const out = document.createElement("canvas");
    out.width = target.w;
    out.height = target.h;
    const ctx = out.getContext("2d");
    if (!ctx) {
      setErrMsg("Navegador não suporta canvas 2D.");
      return;
    }
    // Fundo navy primeiro — no modo "Caber" preenche as bordas vazias,
    // no modo "Cobrir" fica coberto pela imagem.
    ctx.fillStyle = "#0D1B2A";
    ctx.fillRect(0, 0, target.w, target.h);
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
    setMsg("salvando…");
    setErrMsg(null);
    out.toBlob(
      (blob) => {
        if (!blob) {
          setBusy(false);
          setErrMsg("Falha ao gerar PNG.");
          return;
        }
        const file = new File([blob], `reframe-${Date.now()}.png`, { type: "image/png" });
        const fd = new FormData();
        fd.set("social_post_id", socialPostId);
        fd.set("file", file);
        startTransition(async () => {
          try {
            await uploadMediaFromForm(fd);
            setMsg("✓ enquadramento salvo");
            setDirty(false);
            router.refresh();
          } catch (err) {
            const m = err instanceof Error ? err.message : "erro no upload";
            // Se a imagem fonte for tainted (CORS), `toBlob` chega aqui
            // só se o draw passou — geralmente o erro vai estourar em
            // draw acima. Mantemos fallback genérico.
            setErrMsg(m);
            setMsg(null);
          } finally {
            setBusy(false);
          }
        });
      },
      "image/png",
      0.95,
    );
  }, [router, socialPostId, target.w, target.h, transform, base]);

  const imgWidth = base.w || 0;
  const imgHeight = base.h || 0;

  return (
    <div className={`mx-auto ${maxCls}`}>
      <div
        ref={frameRef}
        className={`relative ${aspect} rounded-lg overflow-hidden border border-border-subtle shadow-sm bg-navy select-none ${
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
          src={mediaUrl}
          alt={`Preview ${channelLabel}`}
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

        {/* Frame helper — linha sutil pra demarcar limites do crop */}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-zimba-gold/50 ring-inset" />

        {/* Hint inicial */}
        {!dirty && imgLoaded && !menuOpen && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 bg-navy/80 text-zimba-gold text-[10px] uppercase tracking-[0.22em] font-bold px-2 py-1 rounded-xs">
            Arraste · scroll = zoom
          </div>
        )}

        {/* Botão de ações — top-right do frame. Dispara stopPropagation
            pra não conflitar com o drag do reframer. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={busy || isPending}
          className="absolute top-2 right-2 h-8 w-8 rounded-md bg-navy/80 text-zimba-gold text-fs-14 font-bold inline-flex items-center justify-center hover:bg-zimba-gold hover:text-navy transition-colors disabled:opacity-40"
          title="Trocar / apagar imagem"
          aria-label="Menu de ações da imagem"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>

        {menuOpen && (
          <div
            className="absolute top-12 right-2 z-20 w-[220px] rounded-md bg-white border border-border-subtle shadow-z-3 overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <ActionItem
              icon="✦"
              label="Gerar nova com IA"
              hint="usa hero como referência (i2i)"
              onClick={() => dispatchAction("generate")}
            />
            <ActionItem
              icon="↑"
              label="Subir do computador"
              hint="PNG / JPG / WEBP até 10MB"
              onClick={() => dispatchAction("upload")}
            />
            <ActionItem
              icon="⤓"
              label="Trazer da fonte"
              hint="puxa hero_image_url da matéria"
              onClick={() => dispatchAction("source")}
            />
            <div className="h-px bg-border-subtle" />
            <ActionItem
              icon="✕"
              label="Apagar imagem"
              hint="legenda fica, status volta pra pendente"
              destructive
              onClick={fireClear}
            />
          </div>
        )}

        {/* Overlay toolbar — fica sobre a imagem, fundo navy translúcido.
            stopPropagation evita conflito com drag/wheel do reframer. */}
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
              title={`Gera PNG ${target.w}×${target.h} e substitui a mídia do post`}
            >
              ✓ Salvar
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
        Output {target.w}×{target.h} ·{" "}
        {fitMode === "cover"
          ? "Cobrir: pode cortar bordas pra preencher tudo."
          : "Caber: foto inteira, fundo navy nas bordas."}{" "}
        Sobrescreve só a mídia do canal (não muda hero da matéria).
      </p>

      {msg && !errMsg && <p className="mt-2 text-[11px] text-eco-green">{msg}</p>}
      {errMsg && <p className="mt-2 text-[11px] text-alert-red">{errMsg}</p>}
    </div>
  );
}

function ActionItem({
  icon,
  label,
  hint,
  onClick,
  destructive,
}: {
  icon: string;
  label: string;
  hint: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
        destructive
          ? "text-alert-red hover:bg-alert-red hover:text-white"
          : "text-navy hover:bg-zimba-gold/15"
      }`}
    >
      <span aria-hidden className="text-fs-15 mt-0.5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-fs-13 leading-tight">{label}</span>
        <span className="block text-[10px] uppercase tracking-[0.18em] font-bold opacity-70 mt-0.5">
          {hint}
        </span>
      </span>
    </button>
  );
}
