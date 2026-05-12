// Painel inline "Distribuir nas redes" — vive no fim da edição da matéria.
// Concentra tudo que o admin precisa pra mandar pro IG/FB/WhatsApp sem
// pular pro /admin/social ou /admin/estudio:
//   · listar o pacote (1 card por canal)
//   · gerar imagens em lote usando o hero como i2i (PackButton)
//   · regerar legendas via distribuidor (radar)
//   · aprovar / descartar / marcar publicado, post a post
//
// Quando ainda não tem pacote, mostra empty state + botão pra rodar o
// Distribuidor (precisa da matéria estar publicada/aprovada — o radar
// se vira).

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  approveSocialPost,
  dismissSocialPost,
  markSocialPostPublished,
  regenerateSocialPack,
} from "@/lib/actions/social";
import { PackButton } from "@/app/admin/estudio/_components/pack-button";
import { TemplateButton, TemplateButtonSingle } from "./template-button";

type SocialRow = {
  id: string;
  article_id: string;
  channel: string;
  format: string;
  status: string;
  caption: string | null;
  hashtags: string[] | null;
  text_short: string | null;
  media_url: string | null;
  external_url: string | null;
  error_message: string | null;
  updated_at: string;
};

const CHANNEL_LABEL: Record<string, string> = {
  instagram_feed: "Instagram · feed",
  instagram_story: "Instagram · stories",
  instagram_carousel: "Instagram · carrossel",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  push: "Push",
};

const CHANNEL_ORDER = [
  "instagram_feed",
  "instagram_story",
  "instagram_carousel",
  "facebook",
  "whatsapp",
  "telegram",
  "push",
];

function channelOrder(c: string): number {
  const i = CHANNEL_ORDER.indexOf(c);
  return i === -1 ? 99 : i;
}

function aspectClass(format: string): string {
  if (format === "story_1080x1920") return "aspect-[9/16]";
  if (format === "banner_1200x630") return "aspect-[40/21]";
  if (format === "landscape_16_9") return "aspect-[16/9]";
  return "aspect-square";
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "pendente", cls: "bg-zimba-gold/15 text-navy border-zimba-gold/40" },
  ready: { label: "aprovado", cls: "bg-eco-green/10 text-eco-green border-eco-green/40" },
  published: { label: "no ar", cls: "bg-navy text-zimba-gold border-navy" },
  failed: { label: "descartado", cls: "bg-ink-100 text-ink-500 border-border-subtle" },
};

export async function SocialDistribution({
  articleId,
  articlePublished,
}: {
  articleId: string;
  articlePublished: boolean;
}) {
  const supabase = createClient();
  const { data: postsRaw } = await supabase
    .from("social_posts")
    .select(
      "id, article_id, channel, format, status, caption, hashtags, text_short, media_url, external_url, error_message, updated_at",
    )
    .eq("article_id", articleId)
    .neq("status", "failed")
    .order("created_at", { ascending: true });

  const posts = ((postsRaw ?? []) as SocialRow[]).sort(
    (a, b) => channelOrder(a.channel) - channelOrder(b.channel),
  );

  return (
    <section
      aria-labelledby="social-dist-title"
      className="rounded-md border-2 border-zimba-blue/30 bg-white overflow-hidden"
    >
      <header className="px-5 py-3 bg-zimba-blue/5 border-b border-zimba-blue/20 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-blue">
            Distribuir nas redes
          </p>
          <h2
            id="social-dist-title"
            className="font-display font-black text-fs-20 text-navy leading-tight mt-0.5"
          >
            📣 Pacote social
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {posts.length > 0 && <TemplateButton articleId={articleId} />}
          <form action={regenerateSocialPack}>
            <input type="hidden" name="article_id" value={articleId} />
            <button
              type="submit"
              className="h-9 px-3 rounded-md border border-zimba-blue/40 text-zimba-blue text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-blue hover:text-white transition-colors"
              title="Roda o Distribuidor — regenera legendas pros canais. Não toca nas imagens."
            >
              {posts.length === 0 ? "↻ Gerar pacote" : "↻ Regerar legendas"}
            </button>
          </form>
          <Link
            href={`/admin/estudio/${articleId}`}
            className="text-fs-12 text-ink-500 hover:text-navy underline-offset-2 hover:underline"
            title="Ajuste fino por canvas (texto + imagem)"
          >
            ajuste fino →
          </Link>
        </div>
      </header>

      {posts.length > 0 && (
        <div className="px-5 py-3 bg-off-white/40 border-b border-border-subtle flex items-start gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500">
              Quer trocar as fotos?
            </p>
            <p className="text-fs-12 text-ink-500 mt-0.5">
              Geração com IA cria imagens novas — não usa o hero atual. Útil só quando a foto da fonte
              não pode ser publicada (direitos, qualidade ruim, etc.). Pode dar resultado estranho:
              <span className="font-bold"> revise antes de aprovar.</span>
            </p>
          </div>
          <PackButton articleId={articleId} />
        </div>
      )}

      {posts.length === 0 ? (
        <div className="p-8 text-center">
          <p className="font-display font-black text-fs-16 text-ink-500">
            Sem pacote social ainda
          </p>
          <p className="text-fs-13 text-ink-400 mt-2 max-w-[52ch] mx-auto">
            {articlePublished
              ? "Clique em ↻ Gerar pacote acima — o Distribuidor monta IG feed/story, Facebook, WhatsApp e Push com legendas baseadas no título e lede. Depois é só 🎨 Aplicar template pra renderizar as imagens com o hero atual."
              : "Publique a matéria primeiro (botão ✓ Publicar agora lá em cima). O Distribuidor roda automaticamente e o template fica pronto pra aplicar. Ou força agora pelo ↻ Gerar pacote."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-border-subtle">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      {posts.length > 0 && (
        <p className="border-t border-border-subtle px-5 py-2 text-fs-11 text-ink-400 bg-off-white/60">
          🎨 <span className="font-bold text-ink-700">Aplicar template</span> renderiza o layout
          oficial do social kit (faixa dourada, pílula da editoria, Georgia) usando o hero atual
          — não gera foto nova.
        </p>
      )}
    </section>
  );
}

function PostCard({ post }: { post: SocialRow }) {
  const badge = STATUS_BADGE[post.status] ?? STATUS_BADGE.pending;
  const caption = post.caption ?? post.text_short ?? "";

  return (
    <article className="bg-white p-4 flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold text-fs-13 text-navy truncate">
            {CHANNEL_LABEL[post.channel] ?? post.channel}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-mono">
            {post.format}
          </p>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.18em] font-bold border ${badge.cls}`}
        >
          {badge.label}
        </span>
      </header>

      {post.media_url ? (
        <a
          href={post.media_url}
          target="_blank"
          rel="noreferrer"
          className={`block rounded-md overflow-hidden border border-border-subtle bg-navy ${aspectClass(post.format)} relative group`}
          title="Abrir mídia em tamanho real"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.media_url}
            alt={`Preview ${post.channel}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <span className="absolute inset-0 bg-navy/0 group-hover:bg-navy/15 transition-colors" />
        </a>
      ) : post.format === "text_only" ? (
        <div
          className={`${aspectClass(post.format)} rounded-md border border-dashed border-border-subtle bg-off-white flex items-center justify-center px-2`}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-bold text-center">
            somente texto
          </p>
        </div>
      ) : (
        <div
          className={`${aspectClass(post.format)} rounded-md border border-dashed border-alert-red/30 bg-alert-red/5 flex items-center justify-center px-2`}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-alert-red font-bold text-center">
            sem imagem
          </p>
        </div>
      )}

      {caption && (
        <p className="text-fs-12 text-ink-700 leading-snug line-clamp-4 whitespace-pre-line">
          {caption}
        </p>
      )}

      {post.hashtags && post.hashtags.length > 0 && (
        <p className="text-fs-11 text-zimba-blue font-mono break-words line-clamp-2">
          {post.hashtags.slice(0, 6).join(" ")}
        </p>
      )}

      {post.error_message && (
        <p className="text-fs-11 text-alert-red">⚠ {post.error_message}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {post.format !== "text_only" && post.status !== "published" && (
          <TemplateButtonSingle socialPostId={post.id} />
        )}
        {post.status === "pending" && (
          <>
            <form action={approveSocialPost} className="contents">
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                className="h-8 px-3 rounded-md bg-eco-green text-white text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity"
              >
                ✓ Aprovar
              </button>
            </form>
            <form action={dismissSocialPost} className="contents">
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                className="h-8 px-2 rounded-md border border-alert-red/30 text-alert-red text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-alert-red hover:text-white transition-colors"
                title="Tira da fila"
              >
                ✕
              </button>
            </form>
          </>
        )}
        {post.status === "ready" && (
          <>
            <form action={markSocialPostPublished} className="contents">
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                className="h-8 px-3 rounded-md bg-navy text-zimba-gold text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-zimba-gold hover:text-navy transition-colors"
                title="Marca como publicado sem URL — você cola depois se quiser"
              >
                no ar →
              </button>
            </form>
            <form action={dismissSocialPost} className="contents">
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                className="h-8 px-2 rounded-md border border-alert-red/30 text-alert-red text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-alert-red hover:text-white transition-colors"
              >
                ✕
              </button>
            </form>
          </>
        )}
        {post.status === "published" && (
          <>
            <span className="h-8 leading-[32px] px-3 rounded-md bg-eco-green/10 text-eco-green text-[10px] uppercase tracking-[0.2em] font-bold border border-eco-green/30">
              ✓ no ar
            </span>
            {post.external_url && (
              <a
                href={post.external_url}
                target="_blank"
                rel="noreferrer"
                className="h-8 leading-[32px] px-2 rounded-md border border-border-subtle text-ink-700 text-[10px] uppercase tracking-[0.2em] font-bold hover:border-navy hover:text-navy transition-colors"
              >
                ↗ ver
              </a>
            )}
          </>
        )}
      </div>
    </article>
  );
}
