// Cliente HTTP fino pro motor IA (zimbanet-radar). Server-only.
//
// Em dev, o radar roda em http://127.0.0.1:8100. Em prod, configurar via
// RADAR_BASE_URL. Calls são síncronas (await) — endpoints do radar podem
// demorar 5-15s pq chamam Anthropic.

const BASE = process.env.RADAR_BASE_URL || "http://127.0.0.1:8100";
// 180s: o pipeline do radar (curador→investigador→redator) faz vários calls de
// IA e passava de 60s, abortando com "AbortError" — o agente lia errado como
// "token expirou". 3 min cobre o pipeline sem travar o clique.
const TIMEOUT_MS = 180_000;

type RadarErrorBody = { error: string; detail?: string };

// Erro tipado: 'transient' = falha temporária (NÃO é "o motor caiu"); 'retryable'
// = vale tentar de novo (rede/5xx falham rápido; timeout NÃO retenta pra não
// dobrar a espera). A mensagem de transitória deixa claro que é momentâneo — pra
// o agente não ler como "token/MCP/portal caiu" e alarmar o dono à toa.
export class RadarError extends Error {
  transient: boolean;
  retryable: boolean;
  status?: number;
  constructor(
    message: string,
    opts: { transient: boolean; retryable: boolean; status?: number },
  ) {
    super(message);
    this.name = "RadarError";
    this.transient = opts.transient;
    this.retryable = opts.retryable;
    this.status = opts.status;
  }
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

async function radarFetchOnce<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      cache: "no-store",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      ...init,
    });
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    // timeout: transitório mas NÃO retenta (dobraria a espera). rede: retenta.
    throw new RadarError(
      aborted
        ? "o motor demorou demais (timeout)"
        : `falha de rede ao falar com o motor: ${(e as Error)?.message ?? String(e)}`,
      { transient: true, retryable: !aborted },
    );
  } finally {
    clearTimeout(t);
  }
  const raw = await res.text();
  if (!res.ok) {
    let detail = "";
    try {
      const body = JSON.parse(raw) as RadarErrorBody;
      detail = body.detail ?? body.error ?? "";
    } catch {
      detail = raw;
    }
    const transient =
      RETRYABLE_STATUS.has(res.status) || res.status === 408 || res.status === 429;
    throw new RadarError(`radar ${res.status}: ${detail || res.statusText}`, {
      transient,
      retryable: transient,
      status: res.status,
    });
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new RadarError("resposta do motor não é JSON válido", {
      transient: false,
      retryable: false,
    });
  }
}

async function radarFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await radarFetchOnce<T>(path, init);
  } catch (e) {
    // NÃO retenta automaticamente: várias chamadas do radar (ex.: distribuidor,
    // finalize) NÃO são idempotentes — retentar uma resposta perdida duplicaria
    // (post social repetido). Em falha transitória, devolve mensagem CLARA pra o
    // agente não ler como "infra caída" e ele mesmo decidir tentar de novo.
    if (e instanceof RadarError && e.transient) {
      throw new RadarError(
        `motor temporariamente indisponível (${e.message}) — é momentâneo, tente de novo em instantes (não é o token nem o site).`,
        { transient: true, retryable: false, status: e.status },
      );
    }
    throw e;
  }
}

export type DraftResult = {
  scored_item_id: string;
  enriched_item_id: string;
  article_id: string;
  slug: string;
  title: string;
  reused: boolean;
};

export async function draftFromScored(scoredItemId: string): Promise<DraftResult> {
  return radarFetch<DraftResult>(`/pipeline/draft/${encodeURIComponent(scoredItemId)}`);
}

export type FinalizeResult = {
  article_id: string;
  visual: { hero_image_alt: string; image_prompt: string; crop_hint: string } | null;
  distributed_channels: string[];
  social_post_ids: string[];
};

export async function finalizeArticle(
  articleId: string,
  opts: { skipVisual?: boolean; skipDistribute?: boolean } = {},
): Promise<FinalizeResult> {
  const qs = new URLSearchParams();
  if (opts.skipVisual) qs.set("skip_visual", "true");
  if (opts.skipDistribute) qs.set("skip_distribute", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return radarFetch<FinalizeResult>(`/pipeline/finalize/${encodeURIComponent(articleId)}${suffix}`);
}

export type DistribuidorRunResult = {
  article_id: string;
  channels: string[];
  persisted_ids: string[];
  pack: Record<string, unknown>;
  rendered?: Array<{ channel: string; url?: string; error?: string }>;
};

export async function redistributeArticle(articleId: string): Promise<DistribuidorRunResult> {
  const qs = new URLSearchParams({ article_id: articleId });
  return radarFetch<DistribuidorRunResult>(`/agents/distribuidor/run?${qs.toString()}`);
}

export type AgentBatchResult = {
  processed: number;
  failed: number;
  results: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
};

export async function runCurador(limit = 20): Promise<AgentBatchResult> {
  const qs = new URLSearchParams({ limit: String(limit) });
  return radarFetch<AgentBatchResult>(`/agents/curador/run?${qs.toString()}`);
}

export async function runInvestigador(limit = 5): Promise<AgentBatchResult> {
  const qs = new URLSearchParams({ limit: String(limit) });
  return radarFetch<AgentBatchResult>(`/agents/investigador/run?${qs.toString()}`);
}

export async function runRedator(limit = 5): Promise<AgentBatchResult> {
  const qs = new URLSearchParams({ limit: String(limit) });
  return radarFetch<AgentBatchResult>(`/agents/redator/run?${qs.toString()}`);
}

export async function runAnalista(limit = 5): Promise<AgentBatchResult> {
  const qs = new URLSearchParams({ limit: String(limit) });
  return radarFetch<AgentBatchResult>(`/agents/analista/run?${qs.toString()}`);
}

export type CollectAllResult = {
  sources_run: number;
  total_inserted: number;
  results: Array<{ source_id: string; inserted?: number; error?: string }>;
};

export type CollectOneResult = {
  source_id: string;
  inserted?: number;
  error?: string;
  [k: string]: unknown;
};

export async function runCollectAll(): Promise<CollectAllResult> {
  return radarFetch<CollectAllResult>(`/collect/run`);
}

export type PipelineRunAllResult = {
  collect: { sources_run?: number; total_inserted?: number; skipped?: boolean };
  curador: { processed: number; failed: number };
  investigador: { processed: number; failed: number };
  redator: { processed: number; failed: number };
};

export async function runPipelineAll(opts?: {
  skipCollect?: boolean;
}): Promise<PipelineRunAllResult> {
  const qs = new URLSearchParams();
  if (opts?.skipCollect) qs.set("skip_collect", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return radarFetch<PipelineRunAllResult>(`/pipeline/run-all${suffix}`);
}

export async function runCollectSource(sourceId: string): Promise<CollectOneResult> {
  return radarFetch<CollectOneResult>(`/collect/run/${encodeURIComponent(sourceId)}`);
}

export type SubmitUrlResult = {
  url: string;
  raw_item_id?: string;
  inserted?: number;
  duplicate?: boolean;
  scored?: boolean;
  scored_item_id?: string | null;
  decision?: string;
  classification?: string;
  editoria?: string;
  relevance_score?: number;
  reason?: string;
  note?: string;
  curador_error?: string;
  error?: string;
};

// Envia uma URL avulsa pro radar raspar + pontuar (Curador). Cai na /admin/pauta.
export async function submitUrlToRadar(url: string, note?: string): Promise<SubmitUrlResult> {
  return radarFetch<SubmitUrlResult>(`/collect/submit-url`, {
    body: JSON.stringify({ url, note: note ?? null }),
  });
}

export type SchedulerJob = {
  id: string;
  name: string;
  next_run_time: string | null;
  trigger: string;
  max_instances: number;
  coalesce: boolean;
};

export type SchedulerStatus = {
  running: boolean;
  enabled_in_config: boolean;
  timezone?: string;
  jobs: SchedulerJob[];
};

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  return radarFetch<SchedulerStatus>(`/scheduler/status`, { method: "GET" });
}

export async function startScheduler(): Promise<{ running: boolean; jobs?: string[]; reason?: string }> {
  return radarFetch(`/scheduler/start`);
}

export async function stopScheduler(): Promise<{ running: boolean }> {
  return radarFetch(`/scheduler/stop`);
}

export async function runSchedulerJob(jobId: string): Promise<{ ok: boolean; reason?: string }> {
  return radarFetch(`/scheduler/run/${encodeURIComponent(jobId)}`);
}
