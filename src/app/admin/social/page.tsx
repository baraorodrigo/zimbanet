import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";
import { getArticleSourceUrls } from "@/lib/db/articles";
import {
  approveSocialPost,
  dismissSocialPost,
  markSocialPostPublished,
  regenerateSocialPack,
} from "@/lib/actions/social";
import { Header } from "../_components/header";

export const dynamic = "force-dynamic";

type SocialRow = {
  id: string;
  article_id: string;
  channel: string;
  format: string;
  caption: string | null;
  hashtags: string[] | null;
  text_short: string | null;
  media_url: string | null;
  status: string;
  external_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  prompt_version: string | null;
};

type ArticleStub = {
  id: string;
  title: string;
  slug: string;
  editoria: EditoriaSlug;
  status: string;
  hero_image_url: string | null;
  published_at: string | null;
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

const STATUS_FILTERS = [
  { key: "pending", label: "Pendentes", hint: "esperando aprovação" },
  { key: "ready", label: "Aprovados", hint: "ok pra postar" },
  { key: "published", label: "Publicados", hint: "já foram pra rede" },
  { key: "failed", label: "Descartados", hint: "fora da fila" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

export default async function SocialPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const status: StatusKey =
    (STATUS_FILTERS.find((f) => f.key === searchParams?.status)?.key as StatusKey) ?? "pending";

  const supabase = createClient();
  const { data: posts, error } = await supabase
    .from("social_posts")
    .select(
      "id, article_id, channel, format, caption, hashtags, text_short, media_url, status, external_url, scheduled_at, published_at, error_message, created_at, updated_at, prompt_version",
    )
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(120);

  const rows = (posts ?? []) as SocialRow[];
  const articleIds = Array.from(new Set(rows.map((r) => r.article_id))).filter(Boolean);

  let articleMap = new Map<string, ArticleStub>();
  let sourceMap = new Map<string, { url: string; host: string | null }>();
  if (articleIds.length) {
    const [{ data: arts }, sources] = await Promise.all([
      supabase
        .from("articles")
        .select("id, title, slug, editoria, status, hero_image_url, published_at")
        .in("id", articleIds),
      getArticleSourceUrls(articleIds),
    ]);
    articleMap = new Map(((arts ?? []) as ArticleStub[]).map((a) => [a.id, a]));
    sourceMap = sources;
  }

  // Group by article so o admin vê todo o pack junto.
  const grouped = new Map<string, SocialRow[]>();
  for (const r of rows) {
    const arr = grouped.get(r.article_id) ?? [];
    arr.push(r);
    grouped.set(r.article_id, arr);
  }
  const groups = Array.from(grouped.entries()).map(([articleId, items]) => ({
    article: articleMap.get(articleId),
    articleId,
    source: sourceMap.get(articleId) ?? null,
    items: items.sort((a, b) => CHANNEL_ORDER(a.channel) - CHANNEL_ORDER(b.channel)),
  }));

  // Counts pra tabs
  const counts = await supabase
    .from("social_posts")
    .select("status", { count: "exact", head: false });
  const countMap: Record<string, number> = {};
  for (const r of (counts.data ?? []) as { status: string }[]) {
    countMap[r.status] = (countMap[r.status] ?? 0) + 1;
  }

  return (
    <>
      <Header
        kicker="Distribuição"
        title="Social — pacote de posts"
        sub="Pacote gerado pelo Distribuidor sempre que uma matéria é aprovada. Revise, ajuste e leve pra rede."
      />

      <nav className="mt-8 border-b border-border-subtle flex gap-1 overflow-x-auto">
        {STATUS_FILTERS.map((f) => {
          const active = f.key === status;
          const n = countMap[f.key] ?? 0;
          return (
            <Link
              key={f.key}
              href={f.key === "pending" ? "/admin/social" : `/admin/social?status=${f.key}`}
              className={`relative shrink-0 px-4 py-3 -mb-px border-b-2 transition-colors ${
                active
                  ? "border-zimba-gold text-navy"
                  : "border-transparent text-ink-500 hover:text-navy"
              }`}
            >
              <span className="font-display font-bold text-fs-14">{f.label}</span>
              <span
                className={`ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold ${
                  active ? "bg-navy text-zimba-gold" : "bg-ink-100 text-ink-700"
                }`}
              >
                {n}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-400 mt-0.5">
                {f.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      {error && (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          Erro carregando posts: {error.message}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="mt-10 rounded-md border-2 border-dashed border-border-subtle bg-white p-10 text-center">
          <p className="font-display font-black text-fs-20 text-navy">
            {status === "pending"
              ? "Nenhum post esperando"
              : status === "ready"
                ? "Nenhum post aprovado"
                : status === "published"
                  ? "Nada publicado ainda"
                  : "Nenhum post descartado"}
          </p>
          <p className="mt-2 text-fs-14 text-ink-500 max-w-[52ch] mx-auto">
            {status === "pending"
              ? "Quando uma matéria for aprovada, o Distribuidor gera um pacote (Instagram feed/story, Facebook, WhatsApp) e cai aqui pra você revisar."
              : "Mude o filtro acima pra ver outros estados."}
          </p>
          {status === "pending" && (
            <Link
              href="/admin/fila"
              className="inline-block mt-5 h-11 px-5 leading-[44px] rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
            >
              Abrir fila editorial
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map(({ article, articleId, items, source }) => (
            <ArticleGroup
              key={articleId}
              article={article}
              articleId={articleId}
              items={items}
              status={status}
              source={source}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CHANNEL_ORDER(channel: string): number {
  const order = ["instagram_feed", "instagram_story", "instagram_carousel", "facebook", "whatsapp", "telegram", "push"];
  const i = order.indexOf(channel);
  return i === -1 ? 99 : i;
}

function ArticleGroup({
  article,
  articleId,
  items,
  status,
  source,
}: {
  article: ArticleStub | undefined;
  articleId: string;
  items: SocialRow[];
  status: StatusKey;
  source: { url: string; host: string | null } | null;
}) {
  return (
    <article className="rounded-lg border border-border-subtle bg-white overflow-hidden">
      {/* Cabeçalho do grupo: matéria + ações de pacote */}
      <header className="border-b border-border-subtle bg-off-white/60 px-5 py-4 flex flex-wrap items-start gap-4 justify-between">
        <div className="min-w-0 flex-1">
          {article ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
                {EDITORIA_LABEL[article.editoria] ?? article.editoria} ·{" "}
                <span className="text-ink-500">{article.status}</span>
              </p>
              <h2 className="font-display font-black text-fs-20 text-navy mt-1 leading-tight">
                <Link
                  href={`/admin/materias/${article.id}`}
                  className="hover:text-zimba-blue"
                >
                  {article.title}
                </Link>
              </h2>
              {source && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-blue hover:text-navy"
                  title={source.url}
                >
                  📰 Fonte original
                  {source.host && (
                    <span className="font-mono normal-case tracking-normal text-ink-500">
                      {source.host}
                    </span>
                  )}
                  <span aria-hidden>↗</span>
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-alert-red">
                Matéria removida
              </p>
              <p className="font-display font-black text-fs-16 text-ink-500 mt-1">
                article_id {articleId.slice(0, 8)}…
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {article && (
            <Link
              href={`/admin/estudio/${articleId}`}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors"
              title="Abre o pacote no Estúdio — edição completa"
            >
              ✦ Abrir no estúdio
            </Link>
          )}
          {status === "pending" && article && (
            <form action={regenerateSocialPack}>
              <input type="hidden" name="article_id" value={articleId} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-zimba-blue/30 text-zimba-blue text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-blue hover:text-white transition-colors"
                title="Roda o Distribuidor de novo — gera novas legendas"
              >
                ↻ Regenerar pacote
              </button>
            </form>
          )}
        </div>
      </header>

      <div className="divide-y divide-border-subtle">
        {items.map((p) => (
          <PostRow key={p.id} post={p} status={status} />
        ))}
      </div>
    </article>
  );
}

function PostRow({ post, status }: { post: SocialRow; status: StatusKey }) {
  const aspectClass = post.format === "story_1080x1920"
    ? "aspect-[9/16]"
    : post.format === "banner_1200x630"
      ? "aspect-[40/21]"
      : "aspect-square";
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-5 px-5 py-5">
      {/* Coluna 1: canal + thumb + meta */}
      <div className="md:border-r md:border-border-subtle md:pr-5">
        <p className="font-display font-bold text-fs-14 text-navy">
          {CHANNEL_LABEL[post.channel] ?? post.channel}
        </p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400 mt-1 font-mono">
          {post.format}
        </p>

        {/* Thumb da mídia renderizada — clica e abre em tamanho real */}
        {post.media_url ? (
          <a
            href={post.media_url}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 block rounded-md overflow-hidden border border-border-subtle bg-navy ${aspectClass} relative group`}
            title="Abrir mídia em tamanho real"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.media_url}
              alt={`Preview ${post.channel}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 bg-navy/0 group-hover:bg-navy/20 transition-colors" />
          </a>
        ) : post.format === "text_only" ? (
          <div className="mt-3 rounded-md border border-dashed border-border-subtle bg-off-white px-3 py-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-bold">
              somente texto
            </p>
          </div>
        ) : (
          // Placeholder reativo — vira atalho pro Estúdio (que tem o widget
          // EmptyCanvas com Gerar com IA / Da fonte / Upload). Usa ?ch={canal}
          // pra pular direto pro post certo. Mantém o aspect ratio do formato.
          <Link
            href={`/admin/estudio/${post.article_id}?ch=${post.channel}`}
            className={`mt-3 group relative block rounded-md border-2 border-dashed border-zimba-blue/40 bg-zimba-blue/5 hover:border-zimba-blue hover:bg-zimba-blue/10 transition-colors overflow-hidden ${aspectClass}`}
            title="Abrir no Estúdio pra adicionar mídia"
          >
            <div className="absolute inset-0 flex items-center justify-center p-2">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-zimba-blue">
                  Sem mídia
                </p>
                <p className="mt-1.5 text-fs-12 font-bold text-navy leading-tight">
                  ✨ Gerar com IA
                </p>
                <p className="text-fs-12 font-bold text-navy leading-tight">
                  ↑ Subir foto
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-ink-400 font-bold group-hover:text-zimba-blue transition-colors">
                  clique pra abrir
                </p>
              </div>
            </div>
          </Link>
        )}

        <p className="text-fs-12 text-ink-500 mt-3">
          {new Date(post.updated_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        {post.external_url && (
          <a
            href={post.external_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-[10px] uppercase tracking-[0.22em] font-bold text-eco-green hover:text-navy"
          >
            Ver no canal →
          </a>
        )}
      </div>

      {/* Coluna 2: caption + hashtags */}
      <div className="min-w-0">
        {post.caption ? (
          <p className="text-fs-14 text-ink-900 whitespace-pre-line leading-relaxed">
            {post.caption}
          </p>
        ) : post.text_short ? (
          <p className="text-fs-14 text-ink-900 leading-relaxed">{post.text_short}</p>
        ) : (
          <p className="text-fs-13 text-ink-400 italic">sem caption gerado</p>
        )}

        {post.hashtags && post.hashtags.length > 0 && (
          <p className="mt-3 text-fs-12 text-zimba-blue font-mono break-words">
            {post.hashtags.join(" ")}
          </p>
        )}

        {post.error_message && (
          <p className="mt-3 text-fs-12 text-alert-red">⚠ {post.error_message}</p>
        )}
      </div>

      {/* Coluna 3: ações */}
      <div className="flex md:flex-col gap-2 md:w-[180px] shrink-0">
        {status === "pending" && (
          <>
            <form action={approveSocialPost} className="contents">
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                className="flex-1 h-10 rounded-md bg-eco-green text-white text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-green-700 transition-colors"
              >
                Aprovar
              </button>
            </form>
            <form action={dismissSocialPost} className="contents">
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                className="flex-1 h-10 rounded-md border border-alert-red/30 text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-alert-red hover:text-white transition-colors"
              >
                Descartar
              </button>
            </form>
          </>
        )}

        {status === "ready" && (
          <>
            <details className="flex-1 group">
              <summary className="cursor-pointer h-10 leading-[40px] rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold text-center hover:bg-zimba-gold hover:text-navy transition-colors">
                Marcar publicado
              </summary>
              <form
                action={markSocialPostPublished}
                className="absolute z-10 mt-2 right-0 w-[280px] rounded-md border border-border-subtle bg-white p-3 shadow-z-3"
              >
                <input type="hidden" name="id" value={post.id} />
                <label className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500">
                  URL no canal (opcional)
                </label>
                <input
                  name="external_url"
                  type="url"
                  placeholder="https://instagram.com/p/..."
                  className="mt-1 w-full h-9 px-2 rounded border border-border-subtle text-fs-13"
                />
                <button
                  type="submit"
                  className="mt-2 w-full h-9 rounded-md bg-eco-green text-white text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-green-700"
                >
                  Confirmar
                </button>
              </form>
            </details>
            <form action={dismissSocialPost} className="contents">
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                className="flex-1 h-10 rounded-md border border-alert-red/30 text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-alert-red hover:text-white transition-colors"
              >
                Descartar
              </button>
            </form>
          </>
        )}

        {(status === "published" || status === "failed") && (
          <span className="flex-1 h-10 leading-[40px] rounded-md text-center text-[11px] uppercase tracking-[0.22em] font-bold border border-border-subtle text-ink-500">
            {status === "published" ? "✓ no ar" : "descartado"}
          </span>
        )}
      </div>
    </div>
  );
}
