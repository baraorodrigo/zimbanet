import SiteHeader from "@/components/site-header";
import BreakingBar from "@/components/breaking-bar";
import HeroSplit from "@/components/hero-split";
import UltimaHora from "@/components/ultima-hora";
import NewsCard from "@/components/news-card";
import NewsCardList from "@/components/news-card-list";
import SectionHead from "@/components/section-head";
import Sidebar from "@/components/sidebar";
import ZimbaMilGrauWidget from "@/components/zimbamilgrau-widget";
import BazarDaZimbaWidget from "@/components/bazardazimba-widget";
import SiteFooter from "@/components/site-footer";
import { getHomepageData, getLatestArticles, startOfTodayInBrazil } from "@/lib/db/articles";
import { getActiveTickerMessages } from "@/lib/db/ticker";
import { slugFromLabel } from "@/lib/db/types";
import type { TickerItem } from "@/components/breaking-bar";

export const revalidate = 60;

export default async function Home() {
  const {
    heroMain,
    heroSecondary,
    articlesCidade,
    articlesPraias,
    muralPosts,
    bazarItems,
  } = await getHomepageData();

  // Última hora pega os 5 itens mais recentes do pool (ex.: secundárias + cidade).
  const ultimaPool = [...heroSecondary, ...articlesCidade, ...articlesPraias];

  // Ticker: mensagens curadas no /admin/ticker têm prioridade. Sem nenhuma
  // ativa, cai automático nas manchetes publicadas HOJE (fuso BR).
  const tickerExclude = heroMain ? [heroMain.id] : [];
  const [manualTicker, todaysHeadlines] = await Promise.all([
    getActiveTickerMessages(),
    getLatestArticles({
      limit: 12,
      exclude: tickerExclude,
      since: startOfTodayInBrazil(),
    }),
  ]);
  const tickerItems: TickerItem[] = manualTicker.length > 0
    ? manualTicker.map((m) => ({
        id: m.id,
        text: m.text,
        kicker: m.kicker,
        href: m.link,
      }))
    : todaysHeadlines.map((a) => ({
        id: a.id,
        text: a.title,
        kicker: a.editoria,
        href: `/${slugFromLabel(a.editoria)}/${a.slug}`,
      }));

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />
      <BreakingBar items={tickerItems} />

      <main className="zb-container pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
          <div className="min-w-0">
            {heroMain ? (
              <HeroSplit main={heroMain} chamadas={heroSecondary} />
            ) : (
              <EmptyHero />
            )}

            {ultimaPool.length > 0 && <UltimaHora items={ultimaPool} />}

            {articlesCidade.length > 0 && (
              <section>
                <SectionHead title="Cidade" href="/cidade" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {articlesCidade.slice(0, 4).map((a, i) => (
                    <NewsCardList key={a.id} article={a} seed={i + 5} />
                  ))}
                </div>
              </section>
            )}

            {articlesPraias.length > 0 && (
              <section>
                <SectionHead title="Praias · Imbituba e região" href="/praias" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {articlesPraias.slice(0, 2).map((a, i) => (
                    <NewsCard key={a.id} article={a} seed={i + 9} />
                  ))}
                </div>
              </section>
            )}
          </div>

          <Sidebar
            excludeIds={[
              heroMain?.id,
              ...heroSecondary.map((a) => a.id),
              ...articlesCidade.map((a) => a.id),
              ...articlesPraias.map((a) => a.id),
            ].filter((id): id is string => !!id)}
          />
        </div>
      </main>

      <ZimbaMilGrauWidget posts={muralPosts} />

      <div className="zb-container">
        <BazarDaZimbaWidget items={bazarItems} />
      </div>

      <SiteFooter />
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="mt-6 rounded-lg border border-border-subtle bg-white p-12 text-center">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-zimba-gold mb-3">
        ZIMBANET
      </p>
      <p className="font-display text-fs-32 font-black leading-tight text-navy mb-2">
        Imbituba conectada está acordando.
      </p>
      <p className="font-sans text-fs-14 text-ink-500">
        Em breve as primeiras matérias da redação chegam aqui.
      </p>
    </div>
  );
}
