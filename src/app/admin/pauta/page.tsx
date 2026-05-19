import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { draftArticleFromRaw } from "@/lib/actions/articles";
import { Header } from "../_components/header";

export const dynamic = "force-dynamic";

type RawItem = {
  id: string;
  title: string;
  body: string | null;
  url: string;
  image_url: string | null;
  video_url: string | null;
  published_at: string | null;
  fetched_at: string;
  source_id: string;
  sources: { id: string; name: string; priority: string } | null;
};

type SearchParams = {
  source?: string;
  q?: string;
  status?: "novos" | "trabalhadas" | "todos";
};

const WINDOW_DAYS = 7;

export default async function PautaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const sourceFilter = searchParams.source ?? "all";
  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status ?? "novos";

  // Dropdown de fontes ativas
  const { data: activeSources } = await supabase
    .from("sources")
    .select("id, name")
    .eq("active", true)
    .order("name");

  // Raw items das últimas N dias
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let rawQ = supabase
    .from("raw_items")
    .select(
      `id, title, body, url, image_url, video_url, published_at, fetched_at, source_id,
       sources!inner ( id, name, priority, active )`,
    )
    .eq("sources.active", true)
    .gte("fetched_at", cutoff)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(150);

  if (sourceFilter !== "all") {
    rawQ = rawQ.eq("source_id", sourceFilter);
  }

  const { data: rawData, error } = await rawQ;
  let items = (rawData ?? []) as unknown as RawItem[];

  if (q) {
    const lower = q.toLowerCase();
    items = items.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        (r.body ?? "").toLowerCase().includes(lower),
    );
  }

  // Quais raw_items já viraram matéria? raw → scored → article
  const rawIds = items.map((r) => r.id);
  const articleByRaw = new Map<string, { id: string; status: string; slug: string }>();
  if (rawIds.length > 0) {
    const { data: scoredRows } = await supabase
      .from("scored_items")
      .select("id, raw_item_id")
      .in("raw_item_id", rawIds);
    const scoredToRaw = new Map<string, string>();
    for (const s of scoredRows ?? []) scoredToRaw.set(s.id, s.raw_item_id);
    const scoredIds = [...scoredToRaw.keys()];
    if (scoredIds.length > 0) {
      const { data: artRows } = await supabase
        .from("articles")
        .select("id, scored_item_id, status, slug")
        .in("scored_item_id", scoredIds);
      for (const a of artRows ?? []) {
        const rid = scoredToRaw.get(a.scored_item_id as string);
        if (!rid) continue;
        const prev = articleByRaw.get(rid);
        // Prefere o mais avançado
        if (!prev || statusRank(a.status) > statusRank(prev.status)) {
          articleByRaw.set(rid, { id: a.id, status: a.status, slug: a.slug });
        }
      }
    }
  }

  // Contagens pros tabs
  const novosCount = items.filter((r) => !articleByRaw.has(r.id)).length;
  const trabalhadasCount = items.filter((r) => articleByRaw.has(r.id)).length;

  if (status === "novos") {
    items = items.filter((r) => !articleByRaw.has(r.id));
  } else if (status === "trabalhadas") {
    items = items.filter((r) => articleByRaw.has(r.id));
  }

  return (
    <>
      <Header
        kicker="Pauta"
        title="O que saiu nas fontes locais"
        sub={`Tudo que foi raspado nas últimas ${WINDOW_DAYS * 24}h das fontes ativas. Clica em "Reescrever com IA" só nas matérias que tu quer publicar.`}
      />

      {/* Atalho: colar link de outra fonte */}
      <div className="mt-4 rounded-md border border-zimba-gold/40 bg-zimba-gold/5 p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <span className="text-fs-12 font-bold uppercase tracking-[0.18em] text-navy">
          ↗ Não tá na lista?
        </span>
        <span className="text-fs-13 text-ink-700 flex-1">
          Cola o link da matéria de qualquer site e a gente puxa direto.
        </span>
        <Link
          href="/admin/materias/importar"
          className="h-10 px-4 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold inline-flex items-center justify-center transition-colors"
        >
          + Importar de link
        </Link>
      </div>

      {/* Tabs */}
      <nav className="mt-6 flex gap-2 flex-wrap">
        <Tab
          href={qs({ source: sourceFilter, q, status: "novos" })}
          active={status === "novos"}
          label="Novas"
          count={novosCount}
          tone="gold"
        />
        <Tab
          href={qs({ source: sourceFilter, q, status: "trabalhadas" })}
          active={status === "trabalhadas"}
          label="Já trabalhadas"
          count={trabalhadasCount}
          tone="dim"
        />
        <Tab
          href={qs({ source: sourceFilter, q, status: "todos" })}
          active={status === "todos"}
          label="Todas"
          count={novosCount + trabalhadasCount}
        />
      </nav>

      {/* Filtros */}
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
        method="GET"
      >
        <input type="hidden" name="status" value={status} />
        <input
          type="text"
          name="q"
          placeholder="Buscar por título ou texto…"
          defaultValue={q}
          className="input w-full sm:flex-1 sm:max-w-[340px]"
        />
        <div className="flex gap-2 sm:contents">
          <select
            name="source"
            defaultValue={sourceFilter}
            className="input flex-1 min-w-0 sm:flex-none sm:w-[240px]"
          >
            <option value="all">Todas as fontes</option>
            {(activeSources ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-11 px-5 rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-blue transition-colors"
          >
            Filtrar
          </button>
          {(q || sourceFilter !== "all") && (
            <Link
              href={qs({ source: "all", q: "", status })}
              className="h-11 px-4 leading-[44px] rounded-md border border-border-subtle text-ink-500 text-[11px] uppercase tracking-[0.22em] font-bold hover:border-navy hover:text-navy transition-colors"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      {error ? (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          Erro carregando pauta: {error.message}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-8 grid gap-4">
          {items.map((r) => (
            <PautaCard
              key={r.id}
              raw={r}
              linked={articleByRaw.get(r.id) ?? null}
            />
          ))}
        </ul>
      )}
    </>
  );
}

// ---- card -----------------------------------------------------------------

function PautaCard({
  raw,
  linked,
}: {
  raw: RawItem;
  linked: { id: string; status: string; slug: string } | null;
}) {
  const sourceName = raw.sources?.name ?? raw.source_id;
  const publishedAt = raw.published_at ? new Date(raw.published_at) : null;
  const ageHrs = publishedAt
    ? Math.max(0, Math.round((Date.now() - publishedAt.getTime()) / 3_600_000))
    : null;

  const hasThumb = !!raw.image_url;
  const hasVideo = !!raw.video_url;

  return (
    <li className="rounded-md border border-border-subtle bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[140px_1fr] md:grid-cols-[160px_1fr_auto] gap-4 sm:gap-5">
      <a
        href={raw.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative aspect-[16/9] sm:aspect-square rounded-md overflow-hidden border border-border-subtle bg-navy"
        aria-label={`Abrir matéria original "${raw.title}"`}
      >
        {hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={raw.image_url as string}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2 bg-gradient-to-br from-zimba-blue/30 via-navy to-navy">
            <p className="text-off-white/40 text-fs-22 leading-none">📰</p>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-off-white/70">
              só texto
            </p>
          </div>
        )}
        {hasVideo && (
          <span
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-navy/85 text-zimba-gold text-fs-15 shadow-z-1">
              ▶
            </span>
          </span>
        )}
      </a>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
            {sourceName}
          </span>
          {ageHrs !== null && (
            <span className="text-fs-12 text-ink-400">{formatAge(ageHrs)}</span>
          )}
          {hasVideo && (
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-0.5 bg-alert-red/10 text-alert-red">
              ▶ vídeo
            </span>
          )}
          {linked && <LinkedPill linked={linked} />}
        </div>

        <h3 className="font-display font-black text-fs-22 leading-[1.18] text-navy mt-2">
          {raw.title}
        </h3>

        {raw.body && (
          <p className="mt-2 text-fs-14 text-ink-700 leading-relaxed line-clamp-3">
            {raw.body}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:w-[180px] shrink-0 self-start">
        {linked ? (
          <Link
            href={`/admin/materias/${linked.id}`}
            className="flex-1 h-10 rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold hover:text-navy inline-flex items-center justify-center transition-colors"
          >
            → Abrir matéria
          </Link>
        ) : (
          <form action={draftArticleFromRaw} className="contents">
            <input type="hidden" name="raw_item_id" value={raw.id} />
            <button
              type="submit"
              className="flex-1 h-10 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors"
              title="Dispara IA em background, draft aparece na Fila em ~30s"
            >
              ✨ Reescrever com IA
            </button>
          </form>
        )}
        <Link
          href={`/admin/materias/nova?from=${encodeURIComponent(raw.id)}`}
          className="flex-1 h-10 rounded-md border border-navy/20 text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:border-navy inline-flex items-center justify-center"
        >
          Redigir manual
        </Link>
        <a
          href={raw.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-10 rounded-md border border-zimba-blue/40 text-zimba-blue text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-blue hover:text-white inline-flex items-center justify-center transition-colors"
        >
          ↗ Ver fonte
        </a>
      </div>
    </li>
  );
}

// ---- helpers --------------------------------------------------------------

function Tab({
  href,
  active,
  label,
  count,
  tone,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone?: "gold" | "dim";
}) {
  const base =
    "inline-flex items-center gap-2 h-10 px-4 rounded-md border text-[11px] uppercase tracking-[0.22em] font-bold transition-colors";
  const inactive =
    tone === "gold"
      ? "border-border-subtle text-ink-700 hover:border-zimba-gold hover:text-zimba-gold"
      : tone === "dim"
        ? "border-border-subtle text-ink-500 hover:border-navy hover:text-navy"
        : "border-border-subtle text-ink-700 hover:border-navy hover:text-navy";
  const activeCls =
    tone === "gold"
      ? "bg-zimba-gold border-zimba-gold text-navy"
      : tone === "dim"
        ? "bg-ink-100 border-ink-100 text-ink-700"
        : "bg-navy border-navy text-zimba-gold";
  return (
    <Link href={href} className={`${base} ${active ? activeCls : inactive}`}>
      {label}
      <span
        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
          active ? "bg-white/15" : "bg-off-white"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function LinkedPill({
  linked,
}: {
  linked: { id: string; status: string; slug: string };
}) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: "📝 rascunho", bg: "bg-ink-100", fg: "text-ink-700" },
    review: { label: "👁 em revisão", bg: "bg-gold-100", fg: "text-gold-700" },
    scheduled: { label: "🕒 agendada", bg: "bg-zimba-blue/10", fg: "text-zimba-blue" },
    published: { label: "✓ publicada", bg: "bg-eco-green/10", fg: "text-eco-green" },
    archived: { label: "📦 arquivada", bg: "bg-ink-100", fg: "text-ink-500" },
    rejected: { label: "✕ rejeitada", bg: "bg-alert-red/10", fg: "text-alert-red" },
  };
  const s = map[linked.status] ?? map.draft;
  return (
    <Link
      href={`/admin/materias/${linked.id}`}
      className={`text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-0.5 ${s.bg} ${s.fg} hover:bg-navy hover:text-zimba-gold transition-colors`}
    >
      {s.label}
    </Link>
  );
}

function statusRank(status: string): number {
  switch (status) {
    case "published": return 5;
    case "archived": return 4;
    case "scheduled": return 3;
    case "review": return 2;
    case "draft": return 1;
    case "rejected": return 0;
    default: return -1;
  }
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-md border-2 border-dashed border-border-subtle bg-white p-10 text-center">
      <p className="font-display font-black text-fs-20 text-navy">
        Nada na pauta
      </p>
      <p className="mt-2 text-fs-14 text-ink-500 max-w-[52ch] mx-auto">
        Ou as fontes ainda não tiveram coleta nas últimas {WINDOW_DAYS * 24}h, ou o filtro tá apertado demais. Tenta limpar filtros.
      </p>
    </div>
  );
}

function qs(p: { source: string; q: string; status: string }) {
  const sp = new URLSearchParams();
  if (p.source !== "all") sp.set("source", p.source);
  if (p.q) sp.set("q", p.q);
  if (p.status && p.status !== "novos") sp.set("status", p.status);
  const s = sp.toString();
  return s ? `/admin/pauta?${s}` : "/admin/pauta";
}

function formatAge(hours: number) {
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.round(hours / 24);
  return `${days}d atrás`;
}
