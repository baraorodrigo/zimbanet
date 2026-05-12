import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";
import {
  triggerAnalista,
  triggerCollectAll,
  triggerCurador,
  triggerInvestigador,
  triggerPipelineAll,
  triggerRedator,
} from "@/lib/actions/pipeline";
import { getSchedulerStatus } from "@/lib/radar";
import { Header } from "./_components/header";

export const dynamic = "force-dynamic";

async function counts() {
  const supabase = createClient();
  const [
    draft,
    review,
    published,
    rejected,
    sources,
    socialPending,
    rawUnscored,
    scoredApproved,
    enrichedNoArticle,
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "review"),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "rejected"),
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("social_posts").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("raw_items").select("*", { count: "exact", head: true }).eq("is_duplicate", false),
    supabase.from("scored_items").select("*", { count: "exact", head: true }).in("status", ["scored"]).eq("decision", "approve"),
    supabase.from("enriched_items").select("*", { count: "exact", head: true }),
  ]);
  return {
    draft: draft.count ?? 0,
    review: review.count ?? 0,
    published: published.count ?? 0,
    rejected: rejected.count ?? 0,
    sources: sources.count ?? 0,
    socialPending: socialPending.count ?? 0,
    rawUnscored: rawUnscored.count ?? 0,
    scoredApproved: scoredApproved.count ?? 0,
    enrichedNoArticle: enrichedNoArticle.count ?? 0,
  };
}

async function recent() {
  const supabase = createClient();
  const { data } = await supabase
    .from("articles")
    .select("id, title, slug, editoria, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

async function schedulerSnapshot() {
  try {
    return await getSchedulerStatus();
  } catch {
    return null;
  }
}

export default async function AdminHome() {
  const [c, items, sched] = await Promise.all([counts(), recent(), schedulerSnapshot()]);
  const fila = c.draft + c.review;
  const motorRodando = sched?.running ?? false;
  return (
    <>
      <Header
        kicker="Visão geral"
        title="Painel editorial"
        sub={`${fila} matéria${fila === 1 ? "" : "s"} esperando você. ${c.published} publicada${
          c.published === 1 ? "" : "s"
        }.`}
      />

      <Link
        href="/admin/autonomo"
        className={`mt-6 flex items-center gap-3 rounded-md border-2 p-4 transition-colors ${
          motorRodando
            ? "border-eco-green bg-eco-green/5 hover:bg-eco-green/10"
            : "border-alert-red/60 bg-alert-red/5 hover:bg-alert-red/10"
        }`}
      >
        <span
          className={`relative flex h-3 w-3 shrink-0 ${motorRodando ? "" : "opacity-60"}`}
        >
          {motorRodando && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-eco-green opacity-75" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${
              motorRodando ? "bg-eco-green" : "bg-alert-red"
            }`}
          />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display font-black text-fs-15 text-navy leading-tight">
            {motorRodando
              ? "Motor autônomo rodando"
              : "Motor autônomo parado"}
          </p>
          <p className="text-fs-12 text-ink-700 mt-0.5">
            {motorRodando
              ? `${sched?.jobs.length ?? 0} ticks ativos — Coletor, Curador, Investigador, Redator em loop. Você não precisa apertar botão nenhum.`
              : "Os ticks não estão rodando. Abra o módulo autônomo pra ligar."}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold">
          Abrir →
        </span>
      </Link>

      <section className="mt-8 grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="Em fila" value={fila} accent="gold" href="/admin/fila" />
        <Stat label="Rascunho" value={c.draft} href="/admin/fila" />
        <Stat label="Em revisão" value={c.review} href="/admin/fila" />
        <Stat label="Social pendente" value={c.socialPending} href="/admin/social" />
        <Stat label="Publicadas" value={c.published} href="/admin/materias" />
        <Stat label="Fontes ativas" value={c.sources} href="/admin/fontes" />
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between border-b border-border-subtle pb-3 mb-4">
          <h2 className="font-display font-black text-fs-24 text-navy">Atividade recente</h2>
          <Link href="/admin/materias" className="text-fs-13 font-bold text-zimba-blue hover:text-navy">
            Ver tudo →
          </Link>
        </div>
        {items.length === 0 ? (
          <EmptyState
            title="Nada por aqui ainda"
            body="Comece pela Nova matéria — escreva, salve como rascunho, depois publica."
            cta={{ href: "/admin/materias/nova", label: "Criar primeira matéria" }}
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {items.map((a) => (
              <li key={a.id as string}>
                <Link
                  href={`/admin/materias/${a.id}`}
                  className="grid grid-cols-[80px_1fr_auto] gap-4 items-center py-3 hover:bg-white/60 px-2 -mx-2 rounded"
                >
                  <StatusPill status={a.status as string} />
                  <div className="min-w-0">
                    <p className="font-display font-bold text-fs-16 text-navy truncate">{a.title}</p>
                    <p className="text-fs-12 text-ink-500 mt-0.5">
                      {EDITORIA_LABEL[a.editoria as EditoriaSlug] ?? a.editoria} ·{" "}
                      {new Date(a.updated_at as string).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className="text-ink-400 text-fs-13">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between border-b border-border-subtle pb-3 mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-display font-black text-fs-24 text-navy">Pipeline IA</h2>
            <p className="text-fs-13 text-ink-500 mt-0.5">
              Dispare cada etapa do motor manualmente. Em produção, o scheduler roda no auto.
            </p>
          </div>
          <form action={triggerPipelineAll}>
            <button
              type="submit"
              className="h-11 px-5 rounded-md bg-zimba-gold text-navy font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors"
              title="Coletar → Curar → Investigar → Redigir, em sequência (limites moderados)"
            >
              ⚡ Rodar pipeline completo
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <PipelineStep
            n={1}
            title="Coletar"
            sub="RSS / scraper das fontes"
            badge={`${c.sources} ativas`}
            action={triggerCollectAll}
            label="Rodar coleta"
            tone="navy"
          />
          <PipelineStep
            n={2}
            title="Curar"
            sub="Score Haiku, decide pauta"
            badge={`${c.rawUnscored} brutos`}
            action={triggerCurador}
            label="Rodar Curador"
            tone="gold"
          />
          <PipelineStep
            n={3}
            title="Investigar"
            sub="Sonnet enriquece"
            badge={`${c.scoredApproved} aprov.`}
            action={triggerInvestigador}
            label="Rodar Investigador"
            tone="navy"
          />
          <PipelineStep
            n={4}
            title="Redigir"
            sub="Sonnet escreve draft"
            badge={`${c.enrichedNoArticle} brief.`}
            action={triggerRedator}
            label="Rodar Redator"
            tone="gold"
          />
          <PipelineStep
            n={5}
            title="Analisar"
            sub="Haiku revisa publicadas"
            badge={`${c.published} pub.`}
            action={triggerAnalista}
            label="Rodar Analista"
            tone="navy"
          />
        </div>
      </section>

      <section className="mt-12 grid md:grid-cols-2 gap-4">
        <ActionCard
          title="Criar matéria"
          body="Nova matéria do zero — você (ou o Cérebro) escreve direto."
          href="/admin/materias/nova"
          cta="Criar"
        />
        <ActionCard
          title="Revisar fila"
          body="Veja drafts e rascunhos — aprove pra publicar instantaneamente no portal."
          href="/admin/fila"
          cta={`Abrir fila (${fila})`}
        />
      </section>
    </>
  );
}

function PipelineStep({
  n,
  title,
  sub,
  badge,
  action,
  label,
  tone,
}: {
  n: number;
  title: string;
  sub: string;
  badge: string;
  action: () => Promise<void>;
  label: string;
  tone: "navy" | "gold";
}) {
  const accent = tone === "gold" ? "border-zimba-gold" : "border-navy/20";
  const btn =
    tone === "gold"
      ? "bg-zimba-gold text-navy hover:bg-navy hover:text-zimba-gold"
      : "bg-navy text-zimba-gold hover:bg-zimba-gold hover:text-navy";
  return (
    <div className={`rounded-md border-2 ${accent} bg-white p-4 flex flex-col`}>
      <div className="flex items-baseline justify-between">
        <span className="font-display font-black text-fs-24 text-navy">
          {n.toString().padStart(2, "0")}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-ink-400">
          {badge}
        </span>
      </div>
      <p className="font-display font-black text-fs-16 text-navy mt-1">{title}</p>
      <p className="text-fs-12 text-ink-500 mt-0.5 flex-1">{sub}</p>
      <form action={action} className="mt-3">
        <button
          type="submit"
          className={`w-full h-10 rounded-md text-[11px] uppercase tracking-[0.22em] font-bold transition-colors ${btn}`}
        >
          {label}
        </button>
      </form>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent?: "gold";
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md p-4 border transition-all hover:-translate-y-0.5 hover:shadow-z-2 ${
        accent === "gold"
          ? "bg-zimba-gold border-zimba-gold text-navy"
          : "bg-white border-border-subtle text-navy"
      }`}
    >
      <p
        className={`text-[10px] uppercase tracking-[0.24em] font-bold ${
          accent === "gold" ? "text-navy/70" : "text-ink-500"
        }`}
      >
        {label}
      </p>
      <p className="font-display font-black text-fs-44 leading-none mt-2">{value}</p>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    draft: { bg: "bg-ink-100", fg: "text-ink-700", label: "rascunho" },
    review: { bg: "bg-gold-100", fg: "text-gold-700", label: "revisão" },
    scheduled: { bg: "bg-zimba-blue/10", fg: "text-zimba-blue", label: "agendado" },
    published: { bg: "bg-green-100", fg: "text-green-700", label: "publicado" },
    rejected: { bg: "bg-red-100", fg: "text-red-700", label: "rejeitado" },
    archived: { bg: "bg-ink-100", fg: "text-ink-500", label: "arquivado" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      className={`inline-flex justify-center text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-1 ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-md border-2 border-dashed border-border-subtle bg-white p-10 text-center">
      <p className="font-display font-black text-fs-20 text-navy">{title}</p>
      <p className="mt-2 text-fs-14 text-ink-500 max-w-[44ch] mx-auto">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-block mt-5 h-11 px-5 leading-[44px] rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function ActionCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-md border-2 border-border-subtle bg-white p-5 hover:border-navy transition-colors"
    >
      <p className="font-display font-black text-fs-20 text-navy">{title}</p>
      <p className="mt-1 text-fs-14 text-ink-700">{body}</p>
      <span className="inline-block mt-4 text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold group-hover:text-navy">
        {cta} →
      </span>
    </Link>
  );
}
