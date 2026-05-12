import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "../_components/header";
import { toggleSource, deleteSource } from "@/lib/actions/sources";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  rss: "RSS",
  scraper: "Scraper",
  api: "API",
  social: "Social",
  google_alerts: "Google Alerts",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-alert-red/10 text-alert-red",
  medium: "bg-zimba-blue/10 text-zimba-blue",
  low: "bg-ink-100 text-ink-500",
};

type SourceRow = {
  id: string;
  name: string;
  type: string;
  city: string;
  priority: string;
  active: boolean;
  last_fetched_at: string | null;
  error_count: number;
  config: { url?: string } | null;
};

type PhotoStat = {
  total: number;
  withPhoto: number;
};

export default async function FontesPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sources")
    .select("id, name, type, city, priority, active, last_fetched_at, error_count, config")
    .order("active", { ascending: false })
    .order("priority", { ascending: true })
    .order("name", { ascending: true });

  const items = (data ?? []) as SourceRow[];

  // Conta itens coletados por fonte (volume + trava o delete)
  const countsByid: Record<string, number> = {};
  await Promise.all(
    items.map(async (s) => {
      const { count } = await supabase
        .from("raw_items")
        .select("*", { count: "exact", head: true })
        .eq("source_id", s.id);
      countsByid[s.id] = count ?? 0;
    }),
  );

  // Hit rate de foto nos últimos 7 dias — pra detectar fontes que param
  // de mandar foto sem precisar abrir Supabase. Uma query só, agrega em JS.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const photoStats: Record<string, PhotoStat> = {};
  const { data: recentRaw } = await supabase
    .from("raw_items")
    .select("source_id, image_url")
    .gte("fetched_at", sevenDaysAgo)
    .limit(5000);
  for (const row of recentRaw ?? []) {
    const sid = row.source_id as string;
    const stat = photoStats[sid] ?? { total: 0, withPhoto: 0 };
    stat.total += 1;
    if (row.image_url) stat.withPhoto += 1;
    photoStats[sid] = stat;
  }

  const active = items.filter((s) => s.active);
  const inactive = items.filter((s) => !s.active);

  return (
    <>
      <Header
        kicker="Pipeline de coleta"
        title="Fontes"
        sub={`${active.length} ativas · ${inactive.length} pausadas. Cadastra RSS, scrapers e APIs que alimentam o Curador.`}
      />

      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-fs-13 text-ink-500">
          Pra coletar agora, rode <code className="font-mono text-fs-12 px-1.5 py-0.5 rounded border border-border-subtle bg-off-white">npm run curador</code> no terminal.
        </p>
        <Link
          href="/admin/fontes/nova"
          className="h-10 px-4 inline-flex items-center rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
        >
          + Nova fonte
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          {error.message}
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-8 rounded-md border border-border-subtle bg-white p-10 text-center">
          <p className="font-display font-black text-fs-18 text-navy">Nenhuma fonte cadastrada</p>
          <p className="mt-1 text-fs-13 text-ink-500">
            Comece adicionando um feed RSS — é o mais rápido.
          </p>
          <Link
            href="/admin/fontes/nova"
            className="mt-4 inline-block text-fs-13 font-bold text-zimba-blue hover:text-navy underline underline-offset-2"
          >
            Cadastrar primeira fonte →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {items.map((s) => (
            <SourceCard
              key={s.id}
              source={s}
              rawCount={countsByid[s.id] ?? 0}
              photoStat={photoStats[s.id] ?? { total: 0, withPhoto: 0 }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function SourceCard({
  source: s,
  rawCount,
  photoStat,
}: {
  source: SourceRow;
  rawCount: number;
  photoStat: PhotoStat;
}) {
  const url = s.config?.url;
  const hasErrors = s.error_count > 0;
  const photoRate =
    photoStat.total > 0 ? Math.round((photoStat.withPhoto / photoStat.total) * 100) : null;
  // Tons: verde >=70%, dourado 30–69%, vermelho <30%. Sem dado = cinza.
  const photoTone =
    photoRate === null
      ? "text-ink-400"
      : photoRate >= 70
        ? "text-eco-green"
        : photoRate >= 30
          ? "text-zimba-gold"
          : "text-alert-red";

  return (
    <article
      className={`rounded-md border bg-white p-5 transition-colors ${
        s.active ? "border-border-subtle" : "border-border-subtle/60 bg-off-white/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-500">
              {TYPE_LABEL[s.type] ?? s.type}
            </span>
            <span
              className={`text-[10px] uppercase tracking-[0.2em] font-bold rounded px-1.5 py-0.5 ${
                PRIORITY_BADGE[s.priority] ?? PRIORITY_BADGE.medium
              }`}
            >
              {s.priority}
            </span>
            {s.active ? (
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold rounded px-1.5 py-0.5 bg-eco-green/10 text-eco-green">
                ativa
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold rounded px-1.5 py-0.5 bg-ink-100 text-ink-500">
                pausada
              </span>
            )}
          </div>
          <Link
            href={`/admin/fontes/${s.id}`}
            className={`mt-1.5 block font-display font-black text-fs-18 leading-tight truncate hover:text-zimba-blue ${
              s.active ? "text-navy" : "text-ink-500"
            }`}
          >
            {s.name}
          </Link>
          <p className="font-mono text-fs-11 text-ink-500 mt-0.5 truncate">
            {s.id} · {s.city}
          </p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-1 font-mono text-fs-11 text-zimba-blue hover:text-navy truncate underline underline-offset-2"
            >
              {url} ↗
            </a>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-500">Coletados</p>
          <p className="font-display font-black text-fs-22 text-navy">{rawCount}</p>
        </div>
      </div>

      {/* Stats / status footer */}
      <div className="mt-4 flex items-center justify-between gap-3 text-fs-11 text-ink-500 font-mono">
        <span>
          {s.last_fetched_at
            ? `Última: ${new Date(s.last_fetched_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Nunca coletada"}
        </span>
        <span className={hasErrors ? "text-alert-red font-bold" : "text-ink-400"}>
          {hasErrors ? `${s.error_count} erro${s.error_count === 1 ? "" : "s"}` : "ok"}
        </span>
      </div>

      {/* Hit rate de foto — últimos 7 dias */}
      <div className="mt-2 flex items-center justify-between gap-3 text-fs-11 font-mono">
        <span className="text-ink-500">Foto · 7d</span>
        <span className={`font-bold ${photoTone}`} title="Itens com image_url / total coletado nos últimos 7 dias">
          {photoStat.total === 0
            ? "sem coleta"
            : `${photoStat.withPhoto}/${photoStat.total} · ${photoRate}%`}
        </span>
      </div>

      {/* Ações */}
      <div className="mt-4 pt-3 border-t border-border-subtle flex items-center gap-2 flex-wrap">
        <Link
          href={`/admin/fontes/${s.id}`}
          className="h-8 px-3 inline-flex items-center rounded-md border border-navy bg-white text-navy font-bold text-fs-11 uppercase tracking-[0.16em] hover:bg-navy hover:text-zimba-gold transition-colors"
        >
          Editar
        </Link>
        <form action={toggleSource}>
          <input type="hidden" name="id" value={s.id} />
          <button
            type="submit"
            className={`h-8 px-3 inline-flex items-center rounded-md border font-bold text-fs-11 uppercase tracking-[0.16em] transition-colors ${
              s.active
                ? "border-border-subtle bg-white text-ink-500 hover:bg-ink-100 hover:text-navy"
                : "border-eco-green bg-white text-eco-green hover:bg-eco-green hover:text-white"
            }`}
          >
            {s.active ? "Pausar" : "Reativar"}
          </button>
        </form>
        {rawCount === 0 && (
          <form action={deleteSource} className="ml-auto">
            <input type="hidden" name="id" value={s.id} />
            <button
              type="submit"
              className="h-8 px-3 inline-flex items-center rounded-md border border-alert-red bg-white text-alert-red font-bold text-fs-11 uppercase tracking-[0.16em] hover:bg-alert-red hover:text-white transition-colors"
            >
              Apagar
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
