import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/admin";
import { type EditoriaSlug } from "@/lib/db/types";
import { coerceVisualSlots, type VisualSlots } from "@/lib/visual-slots";
import { StudioHeader } from "../_components/studio-header";
import { ChannelRail, type ChannelCard } from "../_components/channel-rail";
import { CanvasStage } from "../_components/canvas-stage";
import { PropertiesShell } from "../_components/properties-shell";
import { StudioShortcuts } from "../_components/studio-shortcuts";
import { KeyboardCheatsheet } from "../_components/keyboard-cheatsheet";
import { UndoToast } from "../_components/undo-toast";
import { HeroCanvas } from "../_components/hero-canvas";

// Pseudo-canal pra "Capa do portal" — aparece no topo da ChannelRail
// como se fosse mais um destino do pacote, mas em vez de social_post
// renderiza o HeroStudio (editor do articles.hero_image_url).
const HERO_CHANNEL = "__hero__";

export const dynamic = "force-dynamic";

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  editoria: EditoriaSlug;
  status: string;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  lede: string | null;
  published_at: string | null;
  visual_slots: unknown | null;
  cities: string[] | null;
  tags: string[] | null;
  scored_item_id: string | null;
};

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

export async function generateMetadata({
  params,
}: {
  params: { article_id: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("articles")
    .select("title")
    .eq("id", params.article_id)
    .maybeSingle();
  const title = (data?.title as string | undefined) ?? "Estúdio";
  return {
    title: `${title} · Estúdio`,
    robots: { index: false, follow: false },
  };
}

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: { article_id: string };
  searchParams?: { ch?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStaff(user)) {
    return (
      <div className="min-h-screen bg-off-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-alert-red">
            Acesso negado
          </p>
          <h1 className="mt-2 font-display font-black text-fs-28 text-navy">
            Sem permissão pra editar
          </h1>
          <p className="mt-3 text-fs-14 text-ink-500">
            Esse estúdio é só pra editores do ZIMBANET. Faça login com a conta
            certa.
          </p>
          <Link
            href="/login?next=/admin/social"
            className="inline-block mt-6 h-11 px-5 leading-[44px] rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
          >
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  const { data: article, error: artErr } = await supabase
    .from("articles")
    .select(
      "id, title, slug, editoria, status, hero_image_url, hero_image_alt, lede, published_at, visual_slots, cities, tags, scored_item_id",
    )
    .eq("id", params.article_id)
    .maybeSingle();

  if (artErr || !article) notFound();

  const articleRow = article as ArticleRow;

  // Origem (raw_items) — articles → scored_items → raw_items
  let sourceUrl: string | null = null;
  let sourceImageUrl: string | null = null;
  if (articleRow.scored_item_id) {
    const { data: scored } = await supabase
      .from("scored_items")
      .select("raw_item_id")
      .eq("id", articleRow.scored_item_id)
      .maybeSingle();
    const rawItemId = (scored as { raw_item_id: string } | null)?.raw_item_id;
    if (rawItemId) {
      const { data: raw } = await supabase
        .from("raw_items")
        .select("url, image_url")
        .eq("id", rawItemId)
        .maybeSingle();
      const rawTyped = raw as { url: string | null; image_url: string | null } | null;
      sourceUrl = rawTyped?.url ?? null;
      sourceImageUrl = rawTyped?.image_url ?? null;
    }
  }

  // Não filtramos status="failed" aqui: o Estúdio é o editor, e o admin
  // precisa enxergar posts descartados pra poder trocar a imagem IA por
  // uma foto real (⋯ → Apagar / Subir do computador → status volta pra
  // pending/ready automaticamente). O badge "descartado" do ChannelRail
  // distingue visualmente.
  const { data: postsRaw } = await supabase
    .from("social_posts")
    .select(
      "id, article_id, channel, format, status, caption, hashtags, text_short, media_url, external_url, updated_at",
    )
    .eq("article_id", articleRow.id);

  const posts = ((postsRaw ?? []) as SocialRow[]).sort(
    (a, b) => channelOrder(a.channel) - channelOrder(b.channel),
  );

  const requestedChannel = searchParams?.ch;
  // O canal "__hero__" é virtual: representa a capa do portal (articles.hero_image_url).
  // Quando ele é o ativo, o canvas central troca pro HeroStudio em vez do CanvasStage.
  const isHeroActive = requestedChannel === HERO_CHANNEL;
  const activeChannel = isHeroActive
    ? HERO_CHANNEL
    : (posts.find((p) => p.channel === requestedChannel)?.channel ??
      posts[0]?.channel ??
      HERO_CHANNEL);
  const activePost = isHeroActive
    ? null
    : (posts.find((p) => p.channel === activeChannel) ?? null);

  const heroCard: ChannelCard = {
    id: HERO_CHANNEL,
    channel: HERO_CHANNEL,
    format: "hero_portal",
    status: articleRow.hero_image_url ? "ready" : "pending",
    hasMedia: !!articleRow.hero_image_url,
    mediaUrl: articleRow.hero_image_url,
    captionPreview: articleRow.hero_image_alt ?? null,
  };

  const channels: ChannelCard[] = [
    heroCard,
    ...posts.map((p) => ({
      id: p.id,
      channel: p.channel,
      format: p.format,
      status: p.status,
      hasMedia: Boolean(p.media_url) || p.format === "text_only",
      mediaUrl: p.media_url,
      captionPreview:
        p.caption?.slice(0, 80) ?? p.text_short?.slice(0, 80) ?? null,
    })),
  ];

  const initialSlots: VisualSlots | null = articleRow.visual_slots
    ? coerceVisualSlots(articleRow.visual_slots)
    : null;

  const articleStub = {
    editoria: articleRow.editoria,
    cities: articleRow.cities,
    tags: articleRow.tags,
    title: articleRow.title,
    heroImageUrl: articleRow.hero_image_url,
    sourceUrl,
    sourceImageUrl,
    hasScoredOrigin: !!articleRow.scored_item_id,
  };

  const channelLabel = isHeroActive
    ? "Capa do portal"
    : (CHANNEL_LABEL[activeChannel] ?? activeChannel);
  const shortcutChannels = posts.map((p) => ({ channel: p.channel }));

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <StudioHeader
        articleId={articleRow.id}
        articleTitle={articleRow.title}
        articleSlug={articleRow.slug}
        articleStatus={articleRow.status}
        editoria={articleRow.editoria}
        packCount={posts.length}
        sourceUrl={sourceUrl}
      />

      <div
        className={`flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] ${
          isHeroActive ? "" : "xl:grid-cols-[280px_1fr_380px]"
        } min-h-0`}
      >
        <ChannelRail
          articleId={articleRow.id}
          channels={channels}
          activeChannel={activeChannel}
        />

        {isHeroActive ? (
          <section className="bg-off-white px-6 lg:px-10 py-8 lg:py-10 min-w-0 overflow-y-auto">
            <div className="mx-auto max-w-[920px]">
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
                  Canvas ativo
                </p>
                <h2 className="mt-1 font-display font-black text-fs-24 text-navy leading-tight">
                  🌐 Capa do portal
                </h2>
                <p className="mt-0.5 text-fs-12 text-ink-500 font-mono">
                  foto-mestra da matéria · aparece na home, nos cards das editorias e no compartilhamento
                </p>
              </div>
              <HeroCanvas
                articleId={articleRow.id}
                articleTitle={articleRow.title}
                articleLede={articleRow.lede}
                heroImageUrl={articleRow.hero_image_url}
                heroImageAlt={articleRow.hero_image_alt}
                hasScoredOrigin={!!articleRow.scored_item_id}
              />
            </div>
          </section>
        ) : (
          <CanvasStage
            post={activePost}
            channelLabel={channelLabel}
            articleId={articleRow.id}
          />
        )}

        {!isHeroActive && (
          <div className="hidden xl:block min-h-0">
            <PropertiesShell
              articleId={articleRow.id}
              socialPost={activePost}
              initialSlots={initialSlots}
              articleStub={articleStub}
              channelLabel={channelLabel}
            />
          </div>
        )}
      </div>

      {/* Painel direito empilhado em telas <xl — só quando não é o hero */}
      {!isHeroActive && (
        <div className="xl:hidden border-t border-border-subtle bg-white">
          <PropertiesShell
            articleId={articleRow.id}
            socialPost={activePost}
            initialSlots={initialSlots}
            articleStub={articleStub}
            channelLabel={channelLabel}
          />
        </div>
      )}

      {/* Atalhos globais — não renderizam nada visual */}
      <StudioShortcuts
        articleId={articleRow.id}
        socialPostId={activePost?.id ?? null}
        channels={shortcutChannels}
      />

      {/* UI flutuante */}
      <KeyboardCheatsheet />
      <UndoToast />

      {/* Hint chip de atalhos — desktop */}
      <div className="fixed bottom-4 right-4 z-30 hidden lg:flex items-center gap-2 bg-navy text-zimba-gold px-3 py-2 rounded-md shadow-z-3 text-[10px] uppercase tracking-[0.18em] font-bold pointer-events-none">
        <kbd className="bg-zimba-gold text-navy px-1.5 py-0.5 rounded font-mono normal-case tracking-normal">
          ⌘↵
        </kbd>
        aprovar
        <span className="opacity-60">·</span>
        <kbd className="bg-zimba-gold text-navy px-1.5 py-0.5 rounded font-mono normal-case tracking-normal">
          G
        </kbd>
        gerar IA
        <span className="opacity-60">·</span>
        <kbd className="bg-zimba-gold text-navy px-1.5 py-0.5 rounded font-mono normal-case tracking-normal">
          ?
        </kbd>
        atalhos
      </div>
    </div>
  );
}
