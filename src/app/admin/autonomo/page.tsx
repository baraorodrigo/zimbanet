import { createClient } from "@/lib/supabase/server";
import { getSchedulerStatus, type SchedulerStatus } from "@/lib/radar";
import {
  triggerSchedulerRunJob,
  triggerSchedulerStart,
  triggerSchedulerStop,
} from "@/lib/actions/scheduler";
import { Header } from "../_components/header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JOB_PRESET: Record<
  string,
  { title: string; sub: string; cost: "low" | "high"; emoji: string }
> = {
  collect_tick: {
    title: "Coletor",
    sub: "RSS + scrapers das fontes ativas",
    cost: "low",
    emoji: "📡",
  },
  curador_tick: {
    title: "Curador",
    sub: "Triagem com Haiku — decide pauta",
    cost: "low",
    emoji: "🧭",
  },
  investigador_tick: {
    title: "Investigador",
    sub: "Sonnet enriquece notícias aprovadas",
    cost: "high",
    emoji: "🔎",
  },
  redator_tick: {
    title: "Redator",
    sub: "Sonnet escreve drafts pra fila",
    cost: "high",
    emoji: "✍️",
  },
  visual_tick: {
    title: "Visual",
    sub: "Haiku gera alt-text + briefing de imagem",
    cost: "low",
    emoji: "🎨",
  },
  analista_tick: {
    title: "Analista",
    sub: "Haiku faz review pós-publish",
    cost: "low",
    emoji: "📊",
  },
};

type AuditRow = {
  id: string;
  entity_id: string;
  action: string;
  actor: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

async function loadStatus(): Promise<{
  status: SchedulerStatus | null;
  error: string | null;
}> {
  try {
    const status = await getSchedulerStatus();
    return { status, error: null };
  } catch (e) {
    return { status: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function recentRuns(): Promise<AuditRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, entity_id, action, actor, metadata, created_at")
    .in("entity_type", ["pipeline", "scheduler"])
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as AuditRow[];
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((d - now) / 1000);
  if (diff <= 0) return "a qualquer momento";
  if (diff < 60) return `em ${diff}s`;
  const min = Math.round(diff / 60);
  if (min < 60) return `em ${min}min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `em ${h}h` : `em ${h}h${rest}min`;
}

function fmtClock(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AutonomoPage() {
  const [{ status, error }, runs] = await Promise.all([loadStatus(), recentRuns()]);
  const running = status?.running ?? false;
  const enabled = status?.enabled_in_config ?? false;
  const jobs = status?.jobs ?? [];

  return (
    <>
      <Header
        kicker="Modo autônomo"
        title={running ? "Motor rodando sozinho" : "Motor parado"}
        sub={
          running
            ? `Scheduler ativo no fuso ${status?.timezone ?? "America/Sao_Paulo"}. Os 4 ticks rodam em loop, ninguém precisa apertar botão.`
            : enabled
              ? "Configurado pra rodar (SCHEDULE_ENABLED=true), mas o scheduler não está ativo no processo. Provavelmente o radar reiniciou."
              : "Scheduler desligado em config (SCHEDULE_ENABLED=false). Liga o flag no .env e reinicia o radar."
        }
      />

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatusCard
          label="Estado"
          value={running ? "ATIVO" : "PARADO"}
          tone={running ? "good" : "bad"}
          hint={running ? "ticks correndo no background" : "nada agendado roda agora"}
        />
        <StatusCard
          label="Configuração"
          value={enabled ? "habilitado" : "desabilitado"}
          tone={enabled ? "good" : "warn"}
          hint=".env / SCHEDULE_ENABLED"
        />
        <StatusCard
          label="Jobs ativos"
          value={String(jobs.length)}
          tone="info"
          hint={running ? "todos com max_instances=1" : "—"}
        />
      </section>

      {error && (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          <strong className="font-bold">Radar não respondeu:</strong> {error}
          <p className="mt-1 text-fs-13 text-alert-red/80">
            Confere se o motor (zimbanet-radar) está rodando em http://127.0.0.1:8100.
          </p>
        </div>
      )}

      <section className="mt-10">
        <div className="flex items-end justify-between border-b border-border-subtle pb-3 mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-display font-black text-fs-24 text-navy">Ticks ativos</h2>
            <p className="text-fs-13 text-ink-500 mt-0.5">
              Cada um roda em loop. Você pode forçar agora se não quiser esperar.
            </p>
          </div>
          <div className="flex gap-2">
            {running ? (
              <form action={triggerSchedulerStop}>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-md bg-alert-red text-white font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-alert-red/85 transition-colors"
                  title="Para o scheduler em runtime — ticks param até religar (config não muda)."
                >
                  ⏸ Pausar motor
                </button>
              </form>
            ) : (
              <form action={triggerSchedulerStart}>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-md bg-eco-green text-white font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-eco-green/85 transition-colors"
                  title="Religa o scheduler (precisa estar habilitado em config)."
                >
                  ▶ Ligar motor
                </button>
              </form>
            )}
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-md border-2 border-dashed border-border-subtle bg-white p-10 text-center">
            <p className="font-display font-black text-fs-20 text-navy">Nenhum tick agendado</p>
            <p className="mt-2 text-fs-14 text-ink-500 max-w-[44ch] mx-auto">
              {running
                ? "O scheduler está vivo mas sem jobs registrados. Algo deu errado no startup do motor."
                : "Liga o motor pra ver os 4 ticks (Coletor, Curador, Investigador, Redator)."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {jobs.map((j) => {
              const preset = JOB_PRESET[j.id];
              return (
                <div
                  key={j.id}
                  className={`rounded-md border-2 ${
                    preset?.cost === "high" ? "border-zimba-gold" : "border-navy/20"
                  } bg-white p-5 flex flex-col`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-fs-24 leading-none">{preset?.emoji ?? "⚙"}</span>
                      <div>
                        <p className="font-display font-black text-fs-18 text-navy leading-tight">
                          {preset?.title ?? j.id}
                        </p>
                        <p className="font-mono text-[11px] text-ink-400 mt-0.5">{j.id}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-1 ${
                        preset?.cost === "high"
                          ? "bg-zimba-gold/15 text-zimba-gold"
                          : "bg-navy/5 text-navy"
                      }`}
                    >
                      {preset?.cost === "high" ? "caro" : "barato"}
                    </span>
                  </div>
                  <p className="mt-3 text-fs-13 text-ink-700">{preset?.sub ?? j.name}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-fs-12">
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-400">
                        Próximo
                      </dt>
                      <dd className="font-display font-bold text-navy">
                        {fmtRelative(j.next_run_time)}
                      </dd>
                      <dd className="text-ink-500 text-[11px] font-mono mt-0.5">
                        {fmtClock(j.next_run_time)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-400">
                        Intervalo
                      </dt>
                      <dd className="font-display font-bold text-navy font-mono">
                        {j.trigger.replace("interval[", "").replace("]", "")}
                      </dd>
                    </div>
                  </dl>
                  <form action={triggerSchedulerRunJob} className="mt-5">
                    <input type="hidden" name="job_id" value={j.id} />
                    <button
                      type="submit"
                      className="w-full h-10 rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold hover:bg-zimba-gold hover:text-navy transition-colors"
                    >
                      Rodar agora
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="border-b border-border-subtle pb-3 mb-4">
          <h2 className="font-display font-black text-fs-24 text-navy">Últimas execuções</h2>
          <p className="text-fs-13 text-ink-500 mt-0.5">
            Tudo que o motor (e os botões manuais) fizeram nas últimas rodadas.
          </p>
        </div>
        {runs.length === 0 ? (
          <div className="rounded-md border-2 border-dashed border-border-subtle bg-white p-10 text-center">
            <p className="font-display font-black text-fs-20 text-navy">Nada registrado ainda</p>
            <p className="mt-2 text-fs-14 text-ink-500 max-w-[44ch] mx-auto">
              Assim que o primeiro tick rodar (ou você apertar um botão de pipeline), aparece aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle border border-border-subtle rounded-md bg-white">
            {runs.map((r) => {
              const meta = r.metadata ?? {};
              const summary = formatMetadata(r.action, meta);
              return (
                <li key={r.id} className="grid grid-cols-[150px_1fr_auto] gap-4 items-baseline px-4 py-3">
                  <span
                    className={`inline-flex justify-center text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-1 ${
                      r.action.startsWith("scheduler")
                        ? "bg-zimba-blue/10 text-zimba-blue"
                        : "bg-eco-green/10 text-eco-green"
                    }`}
                  >
                    {labelFor(r.action)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-fs-14 text-navy truncate">{summary}</p>
                    <p className="text-fs-11 text-ink-500 mt-0.5">
                      por <span className="font-mono">{r.actor}</span>
                    </p>
                  </div>
                  <span className="text-fs-11 font-mono text-ink-400">
                    {new Date(r.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function labelFor(action: string): string {
  const map: Record<string, string> = {
    collect_all: "coleta",
    collect_source: "coleta fonte",
    run_curador: "curador",
    run_investigador: "investigador",
    run_redator: "redator",
    run_analista: "analista",
    run_pipeline_all: "pipeline full",
    scheduler_start: "scheduler ON",
    scheduler_stop: "scheduler OFF",
    scheduler_run_job: "tick manual",
  };
  return map[action] ?? action;
}

function formatMetadata(action: string, meta: Record<string, unknown>): string {
  if (action === "collect_all") {
    const inserted = (meta.inserted as number) ?? 0;
    const sources = (meta.sources_run as number) ?? 0;
    return `${inserted} novo${inserted === 1 ? "" : "s"} de ${sources} fonte${sources === 1 ? "" : "s"}`;
  }
  if (action.startsWith("run_")) {
    const ok = (meta.processed as number) ?? 0;
    const fail = (meta.failed as number) ?? 0;
    return `${ok} processado${ok === 1 ? "" : "s"}${fail > 0 ? ` · ${fail} falha${fail === 1 ? "" : "s"}` : ""}`;
  }
  if (action === "run_pipeline_all") {
    const c = (meta.curador as { processed?: number })?.processed ?? 0;
    const i = (meta.investigador as { processed?: number })?.processed ?? 0;
    const r = (meta.redator as { processed?: number })?.processed ?? 0;
    return `curador ${c} · investigador ${i} · redator ${r}`;
  }
  if (action === "scheduler_run_job") {
    const job = String(meta.job_id ?? "?");
    const ok = meta.ok === true ? "ok" : "fail";
    return `${job} (${ok})`;
  }
  if (action === "scheduler_start") {
    const jobs = (meta.jobs as string[]) ?? [];
    return `${jobs.length} job${jobs.length === 1 ? "" : "s"} ligados`;
  }
  if (action === "scheduler_stop") {
    return "scheduler pausado";
  }
  return JSON.stringify(meta).slice(0, 80);
}

function StatusCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "good" | "bad" | "warn" | "info";
}) {
  const colors: Record<typeof tone, string> = {
    good: "bg-eco-green text-white border-eco-green",
    bad: "bg-alert-red text-white border-alert-red",
    warn: "bg-zimba-gold text-navy border-zimba-gold",
    info: "bg-white text-navy border-border-subtle",
  };
  return (
    <div className={`rounded-md p-5 border-2 ${colors[tone]}`}>
      <p
        className={`text-[10px] uppercase tracking-[0.24em] font-bold ${
          tone === "info" ? "text-ink-500" : "opacity-80"
        }`}
      >
        {label}
      </p>
      <p className="font-display font-black text-fs-32 leading-none mt-2">{value}</p>
      {hint && (
        <p className={`text-fs-12 mt-2 ${tone === "info" ? "text-ink-500" : "opacity-80"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
