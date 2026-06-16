import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "./tokens";
import { checkPermission, type AgentPermissions } from "./permissions";

type AgentRow = {
  id: string;
  permissions: AgentPermissions;
  rate_limit_per_hour: number;
  active: boolean;
  revoked_at: string | null;
};

export type AgentContext = { agent: AgentRow };

// Segundo argumento que o Next passa pra route handlers de segmento dinâmico
// (ex: /api/ai/articles/[id]). Em rotas estáticas (ping) vem undefined.
export type RouteCtx = { params: Record<string, string> };

type Opts = {
  action?: "read" | "write";
  resource?: string; // se omitido, só exige token válido (ex: ping)
  tool: string;
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status });
}

// Embrulha um handler de rota /api/ai com: auth por token, checagem de
// active/revoked, permissão de escopo, rate-limit por agente e auditoria.
export function withAgent(
  opts: Opts,
  handler: (req: Request, ctx: AgentContext, route: RouteCtx) => Promise<Response>,
) {
  return async (req: Request, route: RouteCtx): Promise<Response> => {
    const sb = createAdminClient();
    const auth = req.headers.get("authorization") ?? "";
    const raw = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!raw) return json({ ok: false, error: "token ausente" }, 401);

    const { data: agent } = await sb
      .from("agents")
      .select("id, permissions, rate_limit_per_hour, active, revoked_at")
      .eq("token_hash", hashToken(raw))
      .maybeSingle();

    if (!agent || !agent.active || agent.revoked_at) {
      return json({ ok: false, error: "token invalido ou revogado" }, 401);
    }

    if (
      opts.resource &&
      opts.action &&
      !checkPermission(agent.permissions as AgentPermissions, opts.action, opts.resource)
    ) {
      await sb.from("agent_runs").insert({
        agent_id: agent.id,
        tool: opts.tool,
        action: opts.action,
        resource: opts.resource,
        status: "denied",
        finished_at: new Date().toISOString(),
      });
      return json({ ok: false, error: "sem permissao" }, 403);
    }

    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await sb
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .gte("started_at", since);
    if ((count ?? 0) >= agent.rate_limit_per_hour) {
      return json({ ok: false, error: "rate limit excedido" }, 429);
    }

    const startedAt = new Date().toISOString();
    try {
      const res = await handler(req, { agent: agent as AgentRow }, route);
      await sb.from("agent_runs").insert({
        agent_id: agent.id,
        tool: opts.tool,
        action: opts.action ?? "read",
        resource: opts.resource ?? opts.tool,
        status: "ok",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      await sb.from("agents").update({ last_used_at: new Date().toISOString() }).eq("id", agent.id);
      return res;
    } catch (err) {
      await sb.from("agent_runs").insert({
        agent_id: agent.id,
        tool: opts.tool,
        action: opts.action ?? "read",
        resource: opts.resource ?? opts.tool,
        status: "error",
        detail: { message: String(err).slice(0, 300) },
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return json({ ok: false, error: "erro interno" }, 500);
    }
  };
}
