import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { getWeather, type Weather } from "@/lib/weather";
import { getLatestArticles } from "@/lib/db/articles";
import { slugFromLabel } from "@/lib/db/types";
import Icon from "./icon";
import NewsletterForm from "./newsletter-form";

function MostReadCard({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;
  return (
    <div className="zb-side-card">
      <h3 className="zb-side-card-title">Em destaque</h3>
      <ol className="flex flex-col gap-3.5">
        {articles.slice(0, 5).map((a, i) => (
          <li
            key={a.id}
            className="pb-3.5 border-b border-dashed border-border-subtle last:border-b-0 last:pb-0"
          >
            <Link
              href={`/${slugFromLabel(a.editoria)}/${a.slug}`}
              className="group grid grid-cols-[28px_1fr] gap-3 items-start"
            >
              <span className="font-display font-black text-fs-24 leading-none text-zimba-gold tabular-nums">
                {i + 1}
              </span>
              <h4 className="font-display text-fs-14 font-semibold leading-snug text-navy group-hover:text-zimba-blue text-balance">
                {a.title}
              </h4>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function WeatherCard({ weather }: { weather: Weather }) {
  return (
    <div className="zb-side-card">
      <h3 className="zb-side-card-title">Tempo agora</h3>
      <div className="flex items-center gap-3">
        <Icon name="sun" size={28} className="text-zimba-gold" stroke={2} />
        <div>
          <div className="font-display font-bold text-fs-28 leading-none text-navy">
            {weather.tempC}°C
          </div>
          <div className="text-fs-12 text-ink-500 mt-1">
            {weather.cidade} · {weather.condicao.toLowerCase()} · ondas{" "}
            {weather.ondaM.toString().replace(".", ",")} m
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border-subtle grid grid-cols-4 gap-1 text-center text-fs-12 text-ink-700">
        {weather.proximos.map((d) => (
          <div key={d.dia}>
            <div className="text-[10px] uppercase tracking-tag text-ink-500 font-semibold">
              {d.dia}
            </div>
            <div className="font-display font-bold text-navy mt-1 tabular-nums">
              {d.max}°
              <span className="text-ink-400 ml-0.5 font-normal">{d.min}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function Sidebar({ excludeIds = [] }: { excludeIds?: string[] } = {}) {
  const [weather, latest] = await Promise.all([
    getWeather(),
    getLatestArticles({ limit: 5, exclude: excludeIds }),
  ]);
  return (
    <aside className="space-y-5 mt-6 lg:sticky lg:top-[104px] lg:self-start">
      <NewsletterForm variant="sidebar" />
      <MostReadCard articles={latest} />
      <WeatherCard weather={weather} />
    </aside>
  );
}
