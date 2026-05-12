import { SlotStudio } from "./slot-studio";
import { VariationsGallery } from "./variations-gallery";
import { MediaSourcePicker } from "./media-source-picker";
import { AutoAdaptButton } from "./auto-adapt-button";
import { HistoryPanel } from "./history-panel";
import type { VisualSlots } from "@/lib/visual-slots";

type SocialPostStub = {
  id: string;
  channel: string;
  format: string;
  media_url: string | null;
};

type Props = {
  articleId: string;
  socialPost: SocialPostStub | null;
  initialSlots: VisualSlots | null;
  articleStub: {
    editoria: string;
    cities: string[] | null;
    tags: string[] | null;
    title: string;
    heroImageUrl: string | null;
    sourceUrl: string | null;
    sourceImageUrl: string | null;
    hasScoredOrigin: boolean;
  };
  channelLabel: string;
};

const CHANNEL_LABEL_SHORT: Record<string, string> = {
  instagram_feed: "IG feed",
  instagram_story: "IG stories",
  instagram_carousel: "IG carrossel",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  push: "Push",
};

// PropertiesShell — painel direito do Estúdio. Combina:
//   Topo: SlotStudio — slots de prompt + auto-save
//   Meio: VariationsGallery + MediaSourcePicker — origens de mídia
//   Baixo: AutoAdaptButton + HistoryPanel — caption multi-canal + timeline
export async function PropertiesShell({
  articleId,
  socialPost,
  initialSlots,
  articleStub,
  channelLabel,
}: Props) {
  if (!socialPost) {
    return (
      <aside className="border-l border-border-subtle bg-white h-full p-6 flex items-center justify-center">
        <div className="max-w-[28ch] text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
            Painel
          </p>
          <p className="mt-2 font-display font-black text-fs-16 text-navy">
            Selecione um canal pra editar
          </p>
          <p className="mt-2 text-fs-12 text-ink-500">
            Os controles de imagem, slots IA e adaptação de caption aparecem aqui
            assim que você escolher um post na lateral.
          </p>
        </div>
      </aside>
    );
  }

  const hasHeroImage = !!articleStub.heroImageUrl;
  const hasMedia = !!socialPost.media_url;
  const shortLabel = CHANNEL_LABEL_SHORT[socialPost.channel] ?? channelLabel;

  return (
    <aside className="border-l border-border-subtle bg-white flex flex-col h-full min-h-0">
      {/* Top — Slot Studio (B) ocupa metade da altura, scroll interno próprio */}
      <div className="basis-[55%] flex-shrink min-h-0">
        <SlotStudio
          articleId={articleId}
          socialPostId={socialPost.id}
          initialSlots={initialSlots}
          initialArticle={articleStub}
        />
      </div>

      {/* Bottom — variações + auto-adapt, scroll próprio */}
      <div className="basis-[45%] flex-shrink min-h-0 overflow-y-auto bg-off-white border-t-2 border-zimba-gold/30">
        <VariationsGallery
          articleId={articleId}
          socialPostId={socialPost.id}
          hasHeroImage={hasHeroImage}
          heroImageUrl={articleStub.heroImageUrl}
          sourceImageUrl={articleStub.sourceImageUrl}
          sourceUrl={articleStub.sourceUrl}
          hasScoredOrigin={articleStub.hasScoredOrigin}
        />
        <MediaSourcePicker
          articleId={articleId}
          socialPostId={socialPost.id}
          hasHeroImage={hasHeroImage}
          hasMedia={hasMedia}
        />
        <section className="px-4 py-3 bg-white border-t border-border-subtle">
          <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold mb-2">
            Distribuir caption
          </p>
          <AutoAdaptButton
            socialPostId={socialPost.id}
            channelLabel={shortLabel}
          />
        </section>
        <HistoryPanel socialPostId={socialPost.id} />
      </div>
    </aside>
  );
}
