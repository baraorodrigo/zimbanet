import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";
import { draftArticleWithAI } from "@/lib/actions/articles";
import { Header } from "../_components/header";

export const dynamic = "force-dynamic";

type Decision = "approve" | "investigate" | "reject";
type DecisionFilter = Decision | "all";

type ScoredJoined = {
  id: string;
  raw_item_id: string;
  relevance_score: number;
  virality_score: number;
  risk_score: number;
  risk_flags: string[] | null;
  editoria: string | null;
  decision: Decision;
  ai_reasoning: string | null;
  scored_at: string;
  raw_items: {
    id: string;
    title: string;
    body: string | null;
    url: string;
    image_url: string | null;
    published_at: string | null;
    source_id: string;
    sources: { id: string; name: string; priority: string } | null;
  } | null;
};

type SearchParams = {
  decision?: string;
  editoria?: string;
  q?: string;
};

// Status de matéria-filha que tira o scored_item da pauta — o editor já agiu.
// Rascunho/revisão/agendada continuam aparecendo mas com badge "já tem matéria",
// pra evitar refazer o mesmo trabalho.
const CONSUMED_STATUSES = ["published", "archived", "rejected"];
const IN_PROGRESS_STATUSES = ["draft", "review", "scheduled"];

type LinkedArticle = {
  id: string;
  status: string;
  slug: string;
  editoria: string;
};

export default async function PautaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();

  const decision = (searchParams.decision ?? "investigate") as DecisionFilter;
  const editoria = searchParams.editoria ?? "all";
  const q = (searchParams.q ?? "").trim();

  // 1) Mapa de scored_item_id → matéria-filha (qualquer status).
  // Usado pra (a) tirar da pauta scored_items já consumidos (publicada/arquivada/rejeitada)
  // e (b) anotar com badge os que têm rascunho/revisão pendente.
  const { data: linkedRows } = await supabase
    .from("articles")
    .select("id, scored_item_id, status, slug, editoria")
    .not("scored_item_id", "is", null);

  const linkedByScored = new Map<string, LinkedArticle>();
  for (const r of (linkedRows ?? []) as Array<{
    id: string;
    scored_item_id: string | null;
    status: string;
    slug: string;
    editoria: string;
  }>) {
    if (r.scored_item_id) {
      // Se já há um link, prefere o mais "avançado" (published > scheduled > review > draft > rejected).
      // Evita um draft antigo encobrir uma published mais nova do mesmo scored.
      const prev = linkedByScored.get(r.scored_item_id);
      if (!prev || statusRank(r.status) > statusRank(prev.status)) {
        linkedByScored.set(r.scored_item_id, {
          id: r.id,
          status: r.status,
          slug: r.slug,
          editoria: r.editoria,
        });
      }
    }
  }

  const consumedScoredIds = [...linkedByScored.entries()]
    .filter(([, a]) => CONSUMED_STATUSES.includes(a.status))
    .map(([id]) => id);

  // PostgREST aceita `not.in.(uuid1,uuid2,...)` direto. Se a lista vazia, omite.
  const excludeClause = consumedScoredIds.length > 0
    ? `(${consumedScoredIds.join(",")})`
    : null;

  let query = supabase
    .from("scored_items")
    .select(
      `id, raw_item_id, relevance_score, virality_score, risk_score,
       risk_flags, editoria, decision, ai_reasoning, scored_at,
       raw_items (
         id, title, body, url, image_url, published_at, source_id,
         sources ( id, name, priority )
       )`,
    )
    .order("scored_at", { ascending: false })
    .limit(80);

  if (decision !== "all") query = query.eq("decision", decision);
  if (editoria !== "all") query = query.eq("editoria", editoria);
  if (excludeClause) query = query.not("id", "in", excludeClause);

  const { data, error } = await query;

  let items = (data ?? []) as unknown as ScoredJoined[];
  if (q) {
    const lower = q.toLowerCase();
    items = items.filter(
      (s) =>
        s.raw_items &&
        ((s.raw_items.title ?? "").toLowerCase().includes(lower) ||
          (s.raw_items.body ?? "").toLowerCase().includes(lower)),
    );
  }

  // Counts honoram o mesmo filtro de exclusão pra bater com o que aparece na lista.
  function withExcludeAndDecision(
    qb: ReturnType<typeof supabase.from>,
    dec?: Decision,
  ) {
    let q2 = qb.select("*", { count: "exact", head: true });
    if (dec) q2 = q2.eq("decision", dec);
    if (excludeClause) q2 = q2.not("id", "in", excludeClause);
    return q2;
  }
  const [allCount, approveCount, investigateCount, rejectCount] = await Promise.all([
    withExcludeAndDecision(supabase.from("scored_items")),
    withExcludeAndDecision(supabase.from("scored_items"), "approve"),
    withExcludeAndDecision(supabase.from("scored_items"), "investigate"),
    withExcludeAndDecision(supabase.from("scored_items"), "reject"),
  ]);

  return (
    <>
      <Header
        kicker="Pauta · passo 1 de 2"
        title="O que o Curador trouxe"
        sub={`${items.length} sinais ranqueados pelo Curador (Haiku). Aqui você decide o que vira matéria — depois de "Redigir", o rascunho aparece em Fila pronto pra revisar e publicar.`}
      />

      {/* Tabs por decisão */}
      <nav className="mt-6 flex gap-2 flex-wrap">
        <DecisionTab
          href={qs({ decision: "all", editoria, q })}
          active={decision === "all"}
          label="Tudo"
          count={allCount.count ?? 0}
        />
        <DecisionTab
          href={qs({ decision: "investigate", editoria, q })}
          active={decision === "investigate"}
          label="Investigar"
          count={investigateCount.count ?? 0}
          tone="gold"
        />
        <DecisionTab
          href={qs({ decision: "approve", editoria, q })}
          active={decision === "approve"}
          label="Aprovar"
          count={approveCount.count ?? 0}
          tone="green"
        />
        <DecisionTab
          href={qs({ decision: "reject", editoria, q })}
          active={decision === "reject"}
          label="Rejeitar"
          count={rejectCount.count ?? 0}
          tone="dim"
        />
      </nav>

      {/* Filtros */}
      <form className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3" method="GET">
        <input type="hidden" name="decision" value={decision} />
        <input
          type="text"
          name="q"
          placeholder="Buscar por título ou corpo…"
          defaultValue={q}
          className="input w-full sm:flex-1 sm:max-w-[340px]"
        />
        <div className="flex gap-2 sm:contents">
          <select
            name="editoria"
            defaultValue={editoria}
            className="input flex-1 min-w-0 sm:flex-none sm:w-[200px]"
          >
            <option value="all">Todas editorias</option>
            {Object.entries(EDITORIA_LABEL).map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-11 px-5 rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-blue transition-colors"
          >
            Filtrar
          </button>
          {(q || editoria !== "all") && (
            <Link
              href={qs({ decision, editoria: "all", q: "" })}
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
          {items.map((s) => (
            <PautaCard
              key={s.id}
              scored={s}
              linked={linkedByScored.get(s.id) ?? null}
            />
          ))}
        </ul>
      )}
    </>
  );
}

// ---- card -----------------------------------------------------------------

function PautaCard({
  scored,
  linked,
}: {
  scored: ScoredJoined;
  linked: LinkedArticle | null;
}) {
  const r = scored.raw_items;
  if (!r) return null;
  const editoriaSlug = scored.editoria as EditoriaSlug | null;
  const editoriaLabel = editoriaSlug ? EDITORIA_LABEL[editoriaSlug] ?? editoriaSlug : "—";
  const sourceName = r.sources?.name ?? r.source_id;
  const publishedAt = r.published_at ? new Date(r.published_at) : null;
  const ageHrs = publishedAt
    ? Math.max(0, Math.round((Date.now() - publishedAt.getTime()) / 3_600_000))
    : null;

  const flags = scored.risk_flags ?? [];
  const hasThumb = !!r.image_url;
  const hasInProgressDraft = linked && IN_PROGRESS_STATUSES.includes(linked.status);

  return (
    <li className="rounded-md border border-border-subtle bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[140px_1fr] md:grid-cols-[160px_1fr_auto] gap-4 sm:gap-5">
      {/* Thumb da fonte original — sinal visual do que tá rolando */}
      <a
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative aspect-[16/9] sm:aspect-square rounded-md overflow-hidden border border-border-subtle bg-navy"
        aria-label={
          hasThumb
            ? `Abrir matéria original "${r.title}"`
            : `Abrir matéria original "${r.title}" (sem foto na fonte)`
        }
      >
        {hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.image_url as string}
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
            <p className="mt-0.5 text-[10px] text-off-white/40 leading-tight">
              fonte sem foto
            </p>
          </div>
        )}
      </a>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-gold">
            {editoriaLabel}
          </span>
          <DecisionPill decision={scored.decision} />
          {hasInProgressDraft && linked && <DraftLinkPill linked={linked} />}
          <span className="text-fs-12 text-ink-400">
            {sourceName}
            {ageHrs !== null && ` · ${formatAge(ageHrs)}`}
          </span>
          {flags.length > 0 && (
            <div className="flex gap-1 flex-wrap ml-1">
              {flags.map((f) => (
                <span
                  key={f}
                  className="text-[10px] uppercase tracking-[0.16em] font-bold px-1.5 py-0.5 rounded bg-alert-red/10 text-alert-red"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        <h3 className="font-display font-black text-fs-22 leading-[1.18] text-navy mt-2">
          {r.title}
        </h3>

        {r.body && (
          <p className="mt-2 text-fs-14 text-ink-700 leading-relaxed line-clamp-3">{r.body}</p>
        )}

        {/* scores em barrinhas */}
        <div className="mt-3 grid grid-cols-3 gap-3 max-w-[520px]">
          <ScoreBar label="Relevância" value={scored.relevance_score} tone="navy" />
          <ScoreBar label="Viralidade" value={scored.virality_score} tone="gold" />
          <ScoreBar label="Risco" value={scored.risk_score} tone="red" />
        </div>

        {scored.ai_reasoning && (
          <details className="mt-3">
            <summary className="text-fs-12 text-ink-500 cursor-pointer hover:text-navy select-none">
              ver raciocínio do scorer
            </summary>
            <p className="mt-1.5 text-fs-12 text-ink-700 font-mono leading-relaxed bg-off-white border border-border-subtle rounded p-2.5 whitespace-pre-wrap">
              {scored.ai_reasoning}
            </p>
          </details>
        )}
      </div>

      <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:w-[180px] shrink-0 self-start">
        {hasInProgressDraft && linked ? (
          <Link
            href={`/admin/materias/${linked.id}`}
            className="flex-1 h-10 rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold hover:text-navy inline-flex items-center justify-center transition-colors"
            title="Já existe matéria pra esse sinal — abre direto pra editar"
          >
            → Abrir matéria
          </Link>
        ) : (
          <form action={draftArticleWithAI} className="contents">
            <input type="hidden" name="scored_item_id" value={scored.id} />
            <button
              type="submit"
              className="flex-1 h-10 rounded-md bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-navy hover:text-zimba-gold transition-colors"
              title="Investigador + Redator em sequência. Vai pra fila como rascunho."
            >
              ✨ Redigir com AI
            </button>
          </form>
        )}
        <Link
          href={`/admin/materias/nova?from=${encodeURIComponent(r.id)}`}
          className="flex-1 h-10 rounded-md border border-navy/20 text-navy text-[11px] uppercase tracking-[0.22em] font-bold hover:border-navy inline-flex items-center justify-center"
        >
          Redigir manual
        </Link>
        <a
          href={r.url}
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

// ---- pieces ---------------------------------------------------------------

function DecisionTab({
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
  tone?: "gold" | "green" | "dim";
}) {
  const base = "inline-flex items-center gap-2 h-10 px-4 rounded-md border text-[11px] uppercase tracking-[0.22em] font-bold transition-colors";
  const inactive =
    tone === "gold"
      ? "border-border-subtle text-ink-700 hover:border-zimba-gold hover:text-zimba-gold"
      : tone === "green"
      ? "border-border-subtle text-ink-700 hover:border-eco-green hover:text-eco-green"
      : tone === "dim"
      ? "border-border-subtle text-ink-500 hover:border-navy hover:text-navy"
      : "border-border-subtle text-ink-700 hover:border-navy hover:text-navy";
  const activeCls =
    tone === "gold"
      ? "bg-zimba-gold border-zimba-gold text-navy"
      : tone === "green"
      ? "bg-eco-green border-eco-green text-white"
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

// Pílula que indica que esse scored já gerou matéria — clicável pra abrir o editor.
// Aparece pros statuses em progresso (draft/review/scheduled). Publicada/arquivada/
// rejeitada nem chegam aqui porque já foram filtradas da query.
function DraftLinkPill({ linked }: { linked: LinkedArticle }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    draft: { label: "📝 rascunho", bg: "bg-ink-100", fg: "text-ink-700" },
    review: { label: "👁 em revisão", bg: "bg-gold-100", fg: "text-gold-700" },
    scheduled: { label: "🕒 agendada", bg: "bg-zimba-blue/10", fg: "text-zimba-blue" },
  };
  const s = map[linked.status] ?? map.draft;
  return (
    <Link
      href={`/admin/materias/${linked.id}`}
      className={`text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-0.5 ${s.bg} ${s.fg} hover:bg-navy hover:text-zimba-gold transition-colors`}
      title="Abrir matéria já criada pra esse sinal"
    >
      {s.label}
    </Link>
  );
}

// Rank pra escolher qual matéria-filha "ganha" quando o scored tem mais de uma.
// (raro, mas pode acontecer se o editor redigir manual + AI no mesmo sinal.)
function statusRank(status: string): number {
  switch (status) {
    case "published": return 5;
    case "archived":  return 4;
    case "scheduled": return 3;
    case "review":    return 2;
    case "draft":     return 1;
    case "rejected":  return 0;
    default:          return -1;
  }
}

function DecisionPill({ decision }: { decision: Decision }) {
  const map: Record<Decision, { bg: string; fg: string; label: string }> = {
    approve: { bg: "bg-eco-green/10", fg: "text-eco-green", label: "aprovar" },
    investigate: { bg: "bg-gold-100", fg: "text-gold-700", label: "investigar" },
    reject: { bg: "bg-ink-100", fg: "text-ink-500", label: "rejeitar" },
  };
  const s = map[decision];
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-0.5 ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}

function ScoreBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "navy" | "gold" | "red";
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill =
    tone === "navy" ? "bg-navy" : tone === "gold" ? "bg-zimba-gold" : "bg-alert-red";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.16em] font-bold text-ink-500">
        <span>{label}</span>
        <span className="text-navy">{pct}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-off-white border border-border-subtle overflow-hidden">
        <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-md border-2 border-dashed border-border-subtle bg-white p-10 text-center">
      <p className="font-display font-black text-fs-20 text-navy">Nada na pauta</p>
      <p className="mt-2 text-fs-14 text-ink-500 max-w-[52ch] mx-auto">
        Quando o Curador rodar e encontrar matérias relevantes, elas aparecem aqui pra você
        decidir o que vira matéria do ZIMBANET. Pra rodar manualmente:{" "}
        <code className="font-mono text-fs-12 px-1.5 py-0.5 rounded bg-off-white border border-border-subtle">
          npm run curador
        </code>
      </p>
    </div>
  );
}

// ---- utils ----------------------------------------------------------------

function qs(p: { decision: string; editoria: string; q: string }) {
  const sp = new URLSearchParams();
  if (p.decision !== "all") sp.set("decision", p.decision);
  if (p.editoria !== "all") sp.set("editoria", p.editoria);
  if (p.q) sp.set("q", p.q);
  const s = sp.toString();
  return s ? `/admin/pauta?${s}` : "/admin/pauta";
}

function formatAge(hours: number) {
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.round(hours / 24);
  return `${days}d atrás`;
}
