# AI Gateway — Fase 0 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fundação da integração de agentes — tabelas `agents`/`agent_runs`, biblioteca de token+permissão+auditoria, o wrapper `withAgent`, a rota `/api/ai/ping`, e o `zimbanet-mcp` mínimo conectando ponta a ponta.

**Architecture:** Hermes (local) → `zimbanet-mcp` (local, stdio) → `/api/ai/*` (rotas no portal Next.js, já no ar) → Supabase. O gateway autentica por token de agente (hash), checa permissão/escopo, aplica rate-limit e audita cada chamada em `agent_runs`. Nenhum agente recebe service role; o servidor usa service role internamente.

**Tech Stack:** Next.js 14 route handlers + TypeScript (gateway); `node:crypto` (token), `node:assert`+`tsx` (testes TS, sem novo framework); Supabase (`createAdminClient`); Python + `mcp` + `httpx` + pytest (`zimbanet-mcp`).

**Spec:** `docs/superpowers/specs/2026-06-16-ai-integration-estrutura-design.md`

---

## Estrutura de arquivos (Fase 0)

**Portal (TypeScript):**
- `supabase/migrations/0001_agents.sql` — DDL de `agents` + `agent_runs` + RLS (aplicar via Supabase).
- `src/lib/ai/tokens.ts` — `hashToken` / `verifyToken` (sha256 + timing-safe).
- `src/lib/ai/tokens.test.ts` — teste tsx.
- `src/lib/ai/permissions.ts` — `checkPermission(perms, action, resource)`.
- `src/lib/ai/permissions.test.ts` — teste tsx.
- `src/lib/ai/with-agent.ts` — wrapper: auth + active/revoked + rate-limit + audit.
- `src/app/api/ai/ping/route.ts` — rota GET de teste, embrulhada por `withAgent`.
- `scripts/seed-agent.ts` — cria 1 agente de teste e imprime o token cru (uma vez).

**zimbanet-mcp (Python, roda local com o Hermes):**
- `zimbanet-mcp/pyproject.toml` · `zimbanet-mcp/server.py` · `zimbanet-mcp/client.py`
- `zimbanet-mcp/tools/ping.py` · `zimbanet-mcp/tests/test_client.py` · `zimbanet-mcp/README.md`

---

## Task 1: Migration das tabelas `agents` e `agent_runs`

**Files:**
- Create: `supabase/migrations/0001_agents.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0001_agents.sql
create table if not exists agents (
  id                  text primary key,
  name                text not null,
  type                text not null,
  token_hash          text not null unique,
  permissions         jsonb not null default '{}'::jsonb,
  rate_limit_per_hour int  not null default 120,
  active              boolean not null default true,
  last_used_at        timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists agents_token_hash_idx on agents (token_hash);

create table if not exists agent_runs (
  id          uuid primary key default gen_random_uuid(),
  agent_id    text references agents(id) on delete set null,
  tool        text,
  action      text,
  resource    text,
  status      text not null,
  detail      jsonb,
  tokens_in   int default 0,
  tokens_out  int default 0,
  cost_usd    numeric default 0,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_agent_started_idx on agent_runs (agent_id, started_at desc);

alter table agents     enable row level security;
alter table agent_runs enable row level security;
create policy agents_admin_all     on agents     for all to authenticated using (public.is_admin());
create policy agent_runs_admin_all on agent_runs for all to authenticated using (public.is_admin());
```

- [ ] **Step 2: Aplicar no Supabase**

Aplicar via Supabase MCP (`apply_migration` com o conteúdo do arquivo) OU painel SQL. Projeto: `gavgzpbqrryepgqxzvdk`.

- [ ] **Step 3: Verificar**

Rodar no SQL:
```sql
select count(*) from agents; select count(*) from agent_runs;
```
Expected: ambos retornam `0` sem erro (tabelas existem).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_agents.sql
git commit -m "feat(ai): tabelas agents + agent_runs (fundacao do gateway)"
```

---

## Task 2: Biblioteca de token (`tokens.ts`)

**Files:**
- Create: `src/lib/ai/tokens.ts`
- Test: `src/lib/ai/tokens.test.ts`

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```ts
// src/lib/ai/tokens.test.ts — rodar com: npx tsx src/lib/ai/tokens.test.ts
import assert from "node:assert";
import { generateToken, hashToken, verifyToken } from "./tokens";

const { raw, hash } = generateToken("editor_ia");
assert.ok(raw.startsWith("zmb_editor_ia_"), "token tem prefixo do agente");
assert.equal(hash, hashToken(raw), "hash é determinístico");
assert.equal(verifyToken(raw, hash), true, "verifica token certo");
assert.equal(verifyToken("zmb_errado", hash), false, "rejeita token errado");
console.log("tokens.test OK");
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx src/lib/ai/tokens.test.ts`
Expected: FALHA (`Cannot find module './tokens'`).

- [ ] **Step 3: Implementar**

```ts
// src/lib/ai/tokens.ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export function generateToken(agentId: string): { raw: string; hash: string } {
  const raw = `zmb_${agentId}_${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashToken(raw) };
}

export function verifyToken(raw: string, hash: string): boolean {
  const a = Buffer.from(hashToken(raw), "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx src/lib/ai/tokens.test.ts`
Expected: `tokens.test OK`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/tokens.ts src/lib/ai/tokens.test.ts
git commit -m "feat(ai): biblioteca de token (hash sha256 + timing-safe)"
```

---

## Task 3: Checagem de permissão (`permissions.ts`)

**Files:**
- Create: `src/lib/ai/permissions.ts`
- Test: `src/lib/ai/permissions.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/ai/permissions.test.ts — rodar com: npx tsx src/lib/ai/permissions.test.ts
import assert from "node:assert";
import { checkPermission, type AgentPermissions } from "./permissions";

const editor: AgentPermissions = { read: ["articles", "drafts"], write: ["article_content"] };
assert.equal(checkPermission(editor, "read", "articles"), true);
assert.equal(checkPermission(editor, "write", "article_content"), true);
assert.equal(checkPermission(editor, "write", "homepage"), false, "nega fora do escopo");

const director: AgentPermissions = { read: ["all"], write: [] };
assert.equal(checkPermission(director, "read", "qualquer_coisa"), true, "'all' libera leitura");
assert.equal(checkPermission(director, "write", "articles"), false, "write vazio nega");
console.log("permissions.test OK");
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx src/lib/ai/permissions.test.ts`
Expected: FALHA (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// src/lib/ai/permissions.ts
export type AgentPermissions = { read?: string[]; write?: string[] };

export function checkPermission(
  perms: AgentPermissions,
  action: "read" | "write",
  resource: string,
): boolean {
  const scopes = perms[action] ?? [];
  return scopes.includes("all") || scopes.includes(resource);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx src/lib/ai/permissions.test.ts`
Expected: `permissions.test OK`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/permissions.ts src/lib/ai/permissions.test.ts
git commit -m "feat(ai): checagem de permissao por escopo (read/write)"
```

---

## Task 4: Wrapper `withAgent` (auth + revogação + rate-limit + auditoria)

**Files:**
- Create: `src/lib/ai/with-agent.ts`

Depende de `tokens.ts`, `permissions.ts` e `createAdminClient` (`src/lib/supabase/admin.ts`).

- [ ] **Step 1: Implementar o wrapper**

```ts
// src/lib/ai/with-agent.ts
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

type Opts = {
  action?: "read" | "write";
  resource?: string; // se omitido, só exige token válido (ex: ping)
  tool: string;
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status });
}

export function withAgent(
  opts: Opts,
  handler: (req: Request, ctx: AgentContext) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
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

    // permissão de escopo (ping não passa resource)
    if (opts.resource && opts.action && !checkPermission(agent.permissions, opts.action, opts.resource)) {
      await sb.from("agent_runs").insert({
        agent_id: agent.id, tool: opts.tool, action: opts.action,
        resource: opts.resource, status: "denied", finished_at: new Date().toISOString(),
      });
      return json({ ok: false, error: "sem permissao" }, 403);
    }

    // rate limit: chamadas na última hora
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
      const res = await handler(req, { agent });
      await sb.from("agent_runs").insert({
        agent_id: agent.id, tool: opts.tool, action: opts.action ?? "read",
        resource: opts.resource ?? opts.tool, status: "ok",
        started_at: startedAt, finished_at: new Date().toISOString(),
      });
      await sb.from("agents").update({ last_used_at: new Date().toISOString() }).eq("id", agent.id);
      return res;
    } catch (err) {
      await sb.from("agent_runs").insert({
        agent_id: agent.id, tool: opts.tool, action: opts.action ?? "read",
        resource: opts.resource ?? opts.tool, status: "error",
        detail: { message: String(err).slice(0, 300) },
        started_at: startedAt, finished_at: new Date().toISOString(),
      });
      return json({ ok: false, error: "erro interno" }, 500);
    }
  };
}
```

- [ ] **Step 2: Conferir tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `src/lib/ai/with-agent.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/with-agent.ts
git commit -m "feat(ai): withAgent (auth + revogacao + rate-limit + auditoria)"
```

---

## Task 5: Rota `/api/ai/ping`

**Files:**
- Create: `src/app/api/ai/ping/route.ts`

- [ ] **Step 1: Implementar a rota**

```ts
// src/app/api/ai/ping/route.ts
import { NextResponse } from "next/server";
import { withAgent } from "@/lib/ai/with-agent";

export const dynamic = "force-dynamic";

export const GET = withAgent({ tool: "ping" }, async (_req, { agent }) => {
  return NextResponse.json({ ok: true, data: { agent: agent.id, pong: true } });
});
```

- [ ] **Step 2: Conferir build/tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/ping/route.ts
git commit -m "feat(ai): rota /api/ai/ping (teste do gateway)"
```

---

## Task 6: Seed de um agente de teste

**Files:**
- Create: `scripts/seed-agent.ts`

- [ ] **Step 1: Implementar o script**

```ts
// scripts/seed-agent.ts — rodar com: npx tsx scripts/seed-agent.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken } from "@/lib/ai/tokens";

async function main() {
  const id = "ping_test";
  const { raw, hash } = generateToken(id);
  const sb = createAdminClient();
  const { error } = await sb.from("agents").upsert({
    id, name: "Ping Test", type: "director",
    token_hash: hash, permissions: { read: ["all"], write: [] },
    rate_limit_per_hour: 120, active: true,
  }, { onConflict: "id" });
  if (error) throw error;
  console.log("AGENT:", id);
  console.log("TOKEN (guarde — só aparece aqui):", raw);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Rodar e guardar o token**

Run: `npx tsx scripts/seed-agent.ts` (precisa de `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`)
Expected: imprime `TOKEN (guarde…): zmb_ping_test_...`. Copiar o token.

- [ ] **Step 3: Verificar a rota ponta a ponta (servidor local)**

Em um terminal: `npm run dev` (porta 3100).
Em outro:
```bash
curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:3100/api/ai/ping
# Expected: {"ok":true,"data":{"agent":"ping_test","pong":true}}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/api/ai/ping
# Expected: 401 (sem token)
```
Conferir no SQL que `agent_runs` ganhou linhas e `agents.last_used_at` foi preenchido:
```sql
select agent_id,status,tool from agent_runs order by started_at desc limit 3;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-agent.ts
git commit -m "chore(ai): script de seed de agente de teste"
```

---

## Task 7: `zimbanet-mcp` — scaffold + cliente HTTP

**Files:**
- Create: `zimbanet-mcp/pyproject.toml`, `zimbanet-mcp/client.py`
- Test: `zimbanet-mcp/tests/test_client.py`

- [ ] **Step 1: pyproject**

```toml
# zimbanet-mcp/pyproject.toml
[project]
name = "zimbanet-mcp"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["mcp>=1.2", "httpx>=0.27"]
[project.optional-dependencies]
dev = ["pytest>=8.3", "respx>=0.21"]
```

- [ ] **Step 2: Escrever o teste do cliente (mock httpx via respx)**

```python
# zimbanet-mcp/tests/test_client.py
import httpx, respx, pytest
from client import ZimbanetClient

@respx.mock
def test_get_passes_bearer_and_returns_json():
    route = respx.get("https://x.test/api/ai/ping").mock(
        return_value=httpx.Response(200, json={"ok": True, "data": {"pong": True}})
    )
    c = ZimbanetClient(base_url="https://x.test", token="zmb_abc")
    out = c.get("/api/ai/ping")
    assert out["data"]["pong"] is True
    assert route.calls.last.request.headers["authorization"] == "Bearer zmb_abc"

@respx.mock
def test_raises_on_4xx_with_body():
    respx.get("https://x.test/api/ai/ping").mock(
        return_value=httpx.Response(401, json={"ok": False, "error": "token invalido"})
    )
    c = ZimbanetClient(base_url="https://x.test", token="ruim")
    with pytest.raises(RuntimeError, match="token invalido"):
        c.get("/api/ai/ping")
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd zimbanet-mcp && pip install -e ".[dev]" && python -m pytest -q`
Expected: FALHA (`client` não existe).

- [ ] **Step 4: Implementar o cliente**

```python
# zimbanet-mcp/client.py
import httpx

class ZimbanetClient:
    def __init__(self, base_url: str, token: str, timeout: float = 60.0):
        self._base = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}
        self._timeout = timeout

    def _handle(self, resp: httpx.Response) -> dict:
        data = resp.json() if resp.content else {}
        if resp.status_code >= 400 or (isinstance(data, dict) and data.get("ok") is False):
            msg = (data.get("error") if isinstance(data, dict) else None) or resp.text[:200]
            raise RuntimeError(f"zimbanet {resp.status_code}: {msg}")
        return data

    def get(self, path: str, params: dict | None = None) -> dict:
        with httpx.Client(timeout=self._timeout) as c:
            return self._handle(c.get(self._base + path, headers=self._headers, params=params))

    def post(self, path: str, body: dict | None = None) -> dict:
        with httpx.Client(timeout=self._timeout) as c:
            return self._handle(c.post(self._base + path, headers=self._headers, json=body or {}))
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd zimbanet-mcp && python -m pytest -q`
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add zimbanet-mcp/pyproject.toml zimbanet-mcp/client.py zimbanet-mcp/tests/test_client.py
git commit -m "feat(mcp): cliente HTTP do zimbanet-mcp (+ testes)"
```

---

## Task 8: `zimbanet-mcp` — server + tool `ping`

**Files:**
- Create: `zimbanet-mcp/server.py`, `zimbanet-mcp/tools/ping.py`

- [ ] **Step 1: Tool ping**

```python
# zimbanet-mcp/tools/ping.py
from client import ZimbanetClient

def ping(client: ZimbanetClient) -> dict:
    """Confere que o gateway responde e o token é válido."""
    return client.get("/api/ai/ping")
```

- [ ] **Step 2: Server (registra a tool, lê env)**

```python
# zimbanet-mcp/server.py
import os
from mcp.server.fastmcp import FastMCP
from client import ZimbanetClient
from tools.ping import ping as ping_tool

BASE = os.environ.get("ZIMBANET_API_URL", "https://teste.zimbanet.com")
TOKEN = os.environ.get("AGENT_TOKEN", "")

mcp = FastMCP("zimbanet")
_client = ZimbanetClient(base_url=BASE, token=TOKEN)

@mcp.tool()
def zimbanet_ping() -> dict:
    """Testa a conexão com o Zimbanet (gateway /api/ai)."""
    return ping_tool(_client)

if __name__ == "__main__":
    mcp.run()  # stdio
```

- [ ] **Step 3: Verificar import/boot**

Run: `cd zimbanet-mcp && AGENT_TOKEN=x python -c "import server; print('mcp ok')"`
Expected: `mcp ok` (sem erro de import).

- [ ] **Step 4: Commit**

```bash
git add zimbanet-mcp/server.py zimbanet-mcp/tools/ping.py
git commit -m "feat(mcp): server FastMCP + tool zimbanet_ping"
```

---

## Task 9: README do MCP + verificação ponta a ponta

**Files:**
- Create: `zimbanet-mcp/README.md`

- [ ] **Step 1: README com config do Hermes**

```markdown
# zimbanet-mcp
Servidor MCP que liga o Hermes ao gateway `/api/ai` do Zimbanet. Roda local.

## Setup
    cd zimbanet-mcp && pip install -e .

## Env
- ZIMBANET_API_URL (default https://teste.zimbanet.com)
- AGENT_TOKEN (token do agente, gerado pelo scripts/seed-agent.ts no portal)

## Rodar
    AGENT_TOKEN=zmb_... python server.py

## Plugar no Hermes
Adicionar como MCP server (stdio): comando `python`, args `["server.py"]`, cwd nesta pasta,
env com ZIMBANET_API_URL e AGENT_TOKEN. A tool `zimbanet_ping` deve responder {ok:true}.
```

- [ ] **Step 2: Verificação ponta a ponta (sem Hermes)**

Com `npm run dev` rodando no portal e um agente seedado:
```bash
cd zimbanet-mcp
AGENT_TOKEN=<TOKEN> ZIMBANET_API_URL=http://localhost:3100 python -c "from server import zimbanet_ping; print(zimbanet_ping())"
# Expected: {'ok': True, 'data': {'agent': 'ping_test', 'pong': True}}
```

- [ ] **Step 3: Commit**

```bash
git add zimbanet-mcp/README.md
git commit -m "docs(mcp): README + config pro Hermes"
```

---

## Self-review (feita)

- **Cobertura do spec (Fase 0):** `agents`+`agent_runs` (Task 1), `withAgent` auth/authz/rate-limit/audit (Task 4), `/api/ai/ping` (Task 5), `zimbanet-mcp` mínimo (Tasks 7–9). ✅ Inclui `rate_limit_per_hour`/`last_used_at`/`revoked_at` (decisão da revisão).
- **Sem placeholders:** todo passo de código mostra o código real; comandos com saída esperada.
- **Consistência de tipos:** `AgentPermissions` (permissions.ts) reusado em with-agent.ts; `ZimbanetClient.get/post` usados igual em client.py/tools/server.
- **Nota de deploy:** Tasks 1–6 mexem no portal → quando for pra produção, rebuild do container `portal` no VPS (igual aos deploys desta sessão). O `zimbanet-mcp` roda local, não vai pro VPS.
- **Fora de escopo (Fase 1+):** endpoints de artigos/radar/social/comunidade/bazar/analytics — próximos planos.
