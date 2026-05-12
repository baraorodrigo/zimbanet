"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { approveSocialPost, dismissSocialPost } from "@/lib/actions/social";
import { CaptionEditor } from "./caption-editor";
import { HashtagsEditor } from "./hashtags-editor";
import { EmptyCanvas } from "./empty-canvas";
import { CanvasReframer } from "./canvas-reframer";

type Post = {
  id: string;
  channel: string;
  format: string;
  status: string;
  caption: string | null;
  hashtags: string[] | null;
  text_short: string | null;
  media_url: string | null;
  external_url: string | null;
  updated_at: string;
};

type Props = {
  post: Post | null;
  channelLabel: string;
  articleId: string;
};

const FORMAT_HINT: Record<string, string> = {
  card_1080: "1080×1080 · feed quadrado",
  story_1080x1920: "1080×1920 · vertical",
  carousel_slide: "1080×1080 · slide do carrossel",
  banner_1200x630: "1200×630 · banner OG",
  text_only: "somente texto",
};

function aspectFor(format: string): { box: string; max: string } {
  if (format === "story_1080x1920") return { box: "aspect-[9/16]", max: "max-w-[360px]" };
  if (format === "banner_1200x630") return { box: "aspect-[40/21]", max: "max-w-[640px]" };
  if (format === "text_only") return { box: "aspect-[3/2]", max: "max-w-[520px]" };
  return { box: "aspect-square", max: "max-w-[480px]" };
}

// Canvas central — preview + editores. É client por causa do atalho global
// Cmd/Ctrl+Enter (aprovar) e Cmd/Ctrl+Backspace (descartar).
export function CanvasStage({ post, channelLabel, articleId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Atalhos de teclado globais
  useEffect(() => {
    if (!post) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable);

      // Cmd/Ctrl + Enter = aprovar (funciona mesmo dentro de textarea)
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (post && post.status === "pending") {
          handleApprove();
        }
        return;
      }

      // Cmd/Ctrl + Backspace = descartar (só fora de campo editável pra não atrapalhar)
      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace" && !inEditable) {
        e.preventDefault();
        if (post && (post.status === "pending" || post.status === "ready")) {
          if (confirm("Descartar este post?")) handleDismiss();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, post?.status]);

  function handleApprove() {
    if (!post) return;
    const fd = new FormData();
    fd.set("id", post.id);
    setActionMsg("aprovando…");
    startTransition(async () => {
      try {
        await approveSocialPost(fd);
        setActionMsg("✓ aprovado");
      } catch (err) {
        setActionMsg("erro: " + (err instanceof Error ? err.message : "tente de novo"));
      }
    });
  }

  function handleDismiss() {
    if (!post) return;
    const fd = new FormData();
    fd.set("id", post.id);
    setActionMsg("descartando…");
    startTransition(async () => {
      try {
        await dismissSocialPost(fd);
        setActionMsg("descartado");
      } catch (err) {
        setActionMsg("erro: " + (err instanceof Error ? err.message : "tente de novo"));
      }
    });
  }

  if (!post) {
    return (
      <section className="bg-off-white px-6 lg:px-10 py-10 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-[44ch]">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
            Estúdio
          </p>
          <h2 className="mt-2 font-display font-black text-fs-28 text-navy">
            Escolha um canal na lateral
          </h2>
          <p className="mt-3 text-fs-15 text-ink-500">
            Cada canal do pacote vira um canvas próprio aqui no centro. Selecione na
            esquerda pra começar a editar.
          </p>
        </div>
      </section>
    );
  }

  const { box, max } = aspectFor(post.format);
  const isPending_status = post.status === "pending";
  const isReady = post.status === "ready";
  const isPublished = post.status === "published";
  const isFailed = post.status === "failed";

  return (
    <section className="bg-off-white px-6 lg:px-10 py-8 lg:py-10 min-w-0 overflow-y-auto">
      <div className="mx-auto max-w-[720px]">
        {/* Sub-header do canvas: canal + status */}
        <div className="flex flex-wrap items-center gap-3 justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
              Canvas ativo
            </p>
            <h2 className="mt-1 font-display font-black text-fs-24 text-navy leading-tight">
              {channelLabel}
            </h2>
            <p className="mt-0.5 text-fs-12 text-ink-500 font-mono">
              {FORMAT_HINT[post.format] ?? post.format}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-xs text-[10px] uppercase tracking-[0.22em] font-bold ${
                isPublished
                  ? "bg-eco-green text-white"
                  : isReady
                    ? "bg-eco-green/10 text-eco-green"
                    : isFailed
                      ? "bg-alert-red/10 text-alert-red"
                      : "bg-zimba-gold/15 text-zimba-blue"
              }`}
            >
              {isPublished ? "no ar" : isReady ? "✓ pronto" : isFailed ? "descartado" : "rascunho"}
            </span>
            {post.external_url && (
              <a
                href={post.external_url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-blue hover:text-navy"
              >
                ver no canal →
              </a>
            )}
          </div>
        </div>

        {/* Preview principal — com cropper interativo quando há imagem.
            Drag/scroll dentro do frame reenquadra; "Salvar" grava o
            recorte no tamanho nativo do formato. */}
        {post.media_url ? (
          <CanvasReframer
            key={post.id + ":" + post.media_url}
            socialPostId={post.id}
            mediaUrl={post.media_url}
            format={post.format}
            channelLabel={channelLabel}
          />
        ) : (
          <div className={`mx-auto ${max}`}>
            <div
              className={`relative ${box} rounded-lg overflow-hidden border border-border-subtle shadow-sm`}
            >
              {post.format === "text_only" ? (
                <div className="w-full h-full bg-gradient-to-br from-navy via-zimba-blue to-navy text-zimba-gold flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-[10px] uppercase tracking-[0.28em] font-bold opacity-70">
                    Somente texto
                  </span>
                  <p className="mt-3 font-display font-black text-fs-24 leading-tight max-w-[24ch]">
                    Este canal não precisa de imagem
                  </p>
                  <p className="mt-3 text-fs-13 opacity-80 max-w-[32ch]">
                    Edite a legenda abaixo — essa é a entrega.
                  </p>
                </div>
              ) : (
                <EmptyCanvas articleId={articleId} socialPostId={post.id} />
              )}
            </div>
          </div>
        )}

        {/* Editores */}
        <div className="mt-6 space-y-4">
          {/* Editor de caption (sempre presente, mesmo em text_only) */}
          <CaptionEditor
            socialPostId={post.id}
            initialCaption={post.caption ?? post.text_short ?? ""}
          />

          {/* Editor de hashtags — não faz sentido pra push/whatsapp, mas deixamos visível
              porque o admin pode escolher esvaziar */}
          <HashtagsEditor
            socialPostId={post.id}
            initialHashtags={post.hashtags ?? []}
          />

          {/* Ações finais */}
          <form
            ref={formRef}
            className="flex flex-wrap gap-2 pt-2"
            onSubmit={(e) => e.preventDefault()}
          >
            {isPending_status && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isPending}
                  className="h-11 px-5 rounded-md bg-eco-green text-white text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Aprovar pacote
                  <span className="ml-2 opacity-70 font-mono normal-case tracking-normal">
                    ⌘↵
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Descartar este post?")) handleDismiss();
                  }}
                  disabled={isPending}
                  className="h-11 px-5 rounded-md border border-alert-red/30 text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-alert-red hover:text-white transition-colors disabled:opacity-50"
                >
                  Descartar
                </button>
              </>
            )}
            {isReady && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Descartar este post?")) handleDismiss();
                }}
                disabled={isPending}
                className="h-11 px-5 rounded-md border border-alert-red/30 text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-alert-red hover:text-white transition-colors disabled:opacity-50"
              >
                Descartar
              </button>
            )}
            {(isPublished || isFailed) && (
              <p className="text-fs-13 text-ink-500">
                {isPublished
                  ? "Este post já foi publicado. Edições aqui não voltam pra rede."
                  : "Este post foi descartado. Mude o status na inbox pra editar."}
              </p>
            )}
            {actionMsg && (
              <span className="ml-auto self-center text-fs-12 text-ink-500">{actionMsg}</span>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
