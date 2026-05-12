import Link from "next/link";
import { restoreSocialPost } from "@/lib/actions/social";
import { ApprovePendingButton } from "./approve-pending-button";
import { DeleteCardButton } from "./delete-card-button";

export type ChannelCard = {
  id: string;
  channel: string;
  format: string;
  status: string;
  hasMedia: boolean;
  mediaUrl: string | null;
  captionPreview: string | null;
};

const HERO_CHANNEL = "__hero__";

const CHANNEL_LABEL: Record<string, string> = {
  __hero__: "Capa do portal",
  instagram_feed: "Instagram · feed",
  instagram_story: "Instagram · stories",
  instagram_carousel: "Instagram · carrossel",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  push: "Push",
};

const CHANNEL_GLYPH: Record<string, string> = {
  __hero__: "🌐",
  instagram_feed: "▣",
  instagram_story: "▢",
  instagram_carousel: "▤",
  facebook: "■",
  whatsapp: "◐",
  telegram: "▶",
  push: "◉",
};

function aspectFor(format: string): string {
  if (format === "story_1080x1920") return "aspect-[9/16]";
  if (format === "banner_1200x630") return "aspect-[40/21]";
  if (format === "text_only") return "aspect-[3/2]";
  if (format === "hero_portal") return "aspect-[16/10]";
  return "aspect-square";
}

function statusChip(channel: string, status: string, hasMedia: boolean) {
  if (channel === HERO_CHANNEL) {
    return hasMedia
      ? { label: "✓ no portal", className: "bg-eco-green/10 text-eco-green" }
      : { label: "⚠ sem capa", className: "bg-alert-red/10 text-alert-red" };
  }
  if (status === "published") {
    return { label: "no ar", className: "bg-eco-green text-white" };
  }
  if (status === "ready") {
    return { label: "✓ pronto", className: "bg-eco-green/10 text-eco-green" };
  }
  if (status === "failed") {
    return { label: "descartado", className: "bg-alert-red/10 text-alert-red" };
  }
  if (!hasMedia) {
    return { label: "⚠ sem mídia", className: "bg-alert-red/10 text-alert-red" };
  }
  return { label: "○ rascunho", className: "bg-ink-100 text-ink-600" };
}

function formatHint(format: string): string {
  if (format === "hero_portal") return "foto-mestra · home + cards + share";
  return format.replace(/_/g, " ");
}

type Props = {
  articleId: string;
  channels: ChannelCard[];
  activeChannel: string;
};

// Sidebar esquerda — lista todos os canais do pacote como cards minimalistas.
// Click muda `?ch=` (URL é fonte da verdade). Renderizado como Server Component;
// navegação client-side via <Link>.
export function ChannelRail({ articleId, channels, activeChannel }: Props) {
  const pendingCount = channels.filter(
    (c) => c.channel !== HERO_CHANNEL && c.status === "pending" && c.hasMedia,
  ).length;

  // Conta quantos cards existem por canal — qualquer canal com >1 é duplicata
  // e a UI sinaliza pra o editor saber qual apagar.
  const countsByChannel = new Map<string, number>();
  for (const c of channels) {
    if (c.channel === HERO_CHANNEL) continue;
    countsByChannel.set(c.channel, (countsByChannel.get(c.channel) ?? 0) + 1);
  }
  const dupChannels = new Set(
    [...countsByChannel.entries()].filter(([, n]) => n > 1).map(([k]) => k),
  );

  return (
    <aside className="border-r border-border-subtle bg-white flex flex-col min-w-0">
      <div className="px-5 pt-5 pb-3 border-b border-border-subtle">
        <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
          Destinos
        </p>
        <p className="mt-1 text-fs-12 text-ink-500">
          {channels.filter((c) => c.channel !== HERO_CHANNEL).length} pacote social + capa do portal
        </p>
        {dupChannels.size > 0 && (
          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] font-bold text-alert-red bg-alert-red/5 rounded-xs px-2 py-1 inline-block">
            ⚠ {dupChannels.size} canal{dupChannels.size === 1 ? "" : "is"} com cards duplicados — use o ✕ pra apagar
          </p>
        )}
        <ApprovePendingButton articleId={articleId} pendingCount={pendingCount} />
      </div>

      {channels.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border-2 border-dashed border-alert-red/30 bg-alert-red/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-alert-red">
              Sem posts
            </p>
            <p className="mt-1 text-fs-12 text-ink-500">
              Roda o Distribuidor pra gerar o pacote.
            </p>
          </div>
        </div>
      ) : (
        <nav className="p-3 space-y-2 overflow-y-auto" aria-label="Canais do pacote">
          {channels.map((c) => {
            const active = c.channel === activeChannel;
            const isHero = c.channel === HERO_CHANNEL;
            const chip = statusChip(c.channel, c.status, c.hasMedia);
            const aspect = aspectFor(c.format);
            const isDup = !isHero && dupChannels.has(c.channel);
            const channelLabel = CHANNEL_LABEL[c.channel] ?? c.channel;
            return (
              <div
                key={c.id}
                className={`relative rounded-md border p-3 transition-all group ${
                  active
                    ? "border-zimba-gold bg-gold-50 shadow-z-2"
                    : isDup
                      ? "border-alert-red/40 bg-alert-red/5 hover:border-alert-red hover:shadow-z-2"
                      : isHero
                        ? "border-zimba-gold/40 bg-zimba-gold/5 hover:border-zimba-gold hover:shadow-z-2"
                        : "border-border-subtle bg-white hover:border-navy hover:shadow-z-2"
                }`}
              >
                {!isHero && (
                  <DeleteCardButton
                    id={c.id}
                    label={`${channelLabel} (${c.format.replace(/_/g, " ")})`}
                    isActive={active || isDup}
                  />
                )}
                <Link
                  href={`/admin/estudio/${articleId}?ch=${c.channel}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className="block"
                >
                  <div className="flex items-start gap-3">
                    {/* Thumb / glifo */}
                    <div
                      className={`shrink-0 w-12 ${aspect} rounded overflow-hidden border border-border-subtle bg-navy flex items-center justify-center`}
                    >
                      {c.hasMedia && c.mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.mediaUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className={`${
                            isHero ? "text-fs-18" : "text-fs-16 text-zimba-gold"
                          }`}
                          aria-hidden
                        >
                          {CHANNEL_GLYPH[c.channel] ?? "·"}
                        </span>
                      )}
                    </div>

                    {/* Texto */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-display font-bold text-fs-14 leading-tight truncate ${
                          active ? "text-navy" : "text-ink-800 group-hover:text-navy"
                        }`}
                      >
                        {CHANNEL_LABEL[c.channel] ?? c.channel}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-400 font-mono truncate">
                        {formatHint(c.format)}
                      </p>
                      <span
                        className={`mt-1.5 inline-block px-1.5 py-0.5 rounded-xs text-[10px] uppercase tracking-[0.18em] font-bold ${chip.className}`}
                      >
                        {chip.label}
                      </span>
                      {isDup && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded-xs text-[10px] uppercase tracking-[0.18em] font-bold bg-alert-red text-white">
                          duplicado
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {!isHero && c.status === "failed" && (
                  <form action={restoreSocialPost} className="mt-2 pt-2 border-t border-alert-red/15">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="w-full h-7 rounded border border-alert-red/30 text-alert-red text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-alert-red hover:text-white transition-colors"
                      title="Voltar pra fila de pendentes"
                    >
                      ↺ Restaurar
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
