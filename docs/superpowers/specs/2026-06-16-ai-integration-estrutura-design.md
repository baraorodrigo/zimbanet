# Estrutura de Integração de Agentes de IA — Design (spec)

**Data:** 2026-06-16
**Status:** desenho para revisão (sem código)
**Escopo:** a ESTRUTURA do lado Zimbanet que os agentes do Hermes vão usar. **Não** inclui criar agentes (isso é no Hermes).

---

## 1. Objetivo

Dar aos agentes de IA (que rodam no **Hermes**, do lado do Rodrigo) uma forma **segura, auditável e escalável** de ler e agir no Zimbanet, **sem tocar o banco direto** e **sem nunca publicar sozinho**. Controle editorial humano sobre decisões críticas é inegociável.

## 2. Separação de responsabilidades (princípio central)

| | Onde | O quê |
|---|---|---|
| **Cérebro** 🧠 | **Hermes** (máquina do Rodrigo, assinatura própria) | Os *agentes*: prompts, lógica, decisões, orquestração. |
| **Mãos** ✋ | **Zimbanet** | A *estrutura*: ferramentas, permissões, dados, auditoria. É o que este spec descreve. |

Hermes pensa; Zimbanet executa de forma controlada. A estrutura **não** mora dentro do Hermes.

## 3. Arquitetura (right-sized vs. o doc original)

O documento original previa **AI Gateway** como serviço separado + **MCP server** hospedado. Para um operador solo, isso é infra demais. Versão enxuta, mesma ideia:

```text
  Hermes Agents (local)
        │  (MCP / stdio)
        ▼
  zimbanet-mcp  ── roda junto do Hermes, na máquina do Rodrigo (sem deploy no VPS)
        │  (HTTPS + Bearer token do agente)
        ▼
  /api/ai/*  ── rotas no PORTAL Next.js que já está no ar (este é o "Gateway")
        │  (server-side, service role interno)
        ▼
  Supabase  ·  Server Actions  ·  Radar API (/agents, /pipeline)
```

**Decisões de right-sizing (recomendações — o Rodrigo pode mudar):**
- **Gateway = rotas `/api/ai/*` no portal**, não um serviço novo. Menos uma coisa pra subir/manter.
- **`zimbanet-mcp` roda local com o Hermes** (transporte stdio). Ele só traduz: cada ferramenta MCP → uma chamada HTTPS pro `/api/ai`. Não precisa servidor novo no VPS.
- **MCP é a "tomada"; `/api/ai` é a substância.** A segurança e a lógica ficam no `/api/ai` (não dá pra burlar pelo MCP, pois o token e as permissões são checados no servidor).

## 4. Princípios de segurança (do doc, mantidos)

1. Nenhum agente acessa Supabase diretamente.
2. Nenhum agente executa SQL.
3. Nenhum agente recebe Service Role. (O `/api/ai`, sim, usa service role **internamente** no servidor — o agente só recebe um token escopado.)
4. Toda ação passa pelo `/api/ai`.
5. Toda ação gera auditoria.
6. **(novo)** Nenhum agente publica. Agentes no máximo mandam pra revisão (`submit_review`); **publicar é só humano** pela UI do admin.

## 5. Componente 1 — AI Gateway (`/api/ai/*`)

Route handlers no portal (`src/app/api/ai/`). Cada rota:
1. Lê `Authorization: Bearer <AGENT_TOKEN>`.
2. Resolve o agente (tabela `agents`), valida token (hash), e checa `active` + `revoked_at` (revogado → 401 na hora).
3. Checa **permissão** do agente pra aquele recurso/ação (read/write scope).
4. Valida o payload (zod).
5. Aplica **rate limiting** por agente (`rate_limit_per_hour`, contado em `agent_runs`); atualiza `last_used_at`.
6. Executa a ação (via `createAdminClient` / Server Action / chamada ao radar).
7. Grava **auditoria** (`agent_runs` + `audit_log`).
8. Responde JSON padronizado `{ ok, data, error }`.

Middleware comum: `src/app/api/ai/_lib/withAgent.ts` (auth + authz + audit wrapper) pra todas as rotas usarem.

### 5.1 Contrato de rotas (v-final; v1 só implementa a fatia editorial)

```text
# Editorial
GET    /api/ai/articles?status=draft            list_drafts
GET    /api/ai/articles/{id}                     get_article
POST   /api/ai/articles/{id}/update              update_article (conteudo/metadata)
POST   /api/ai/articles/{id}/review              submit_review  (draft -> review)
# (publish NÃO existe pra agente — humano publica no admin)

# SEO (subconjunto de update, escopo restrito)
POST   /api/ai/articles/{id}/seo                 update slug/seo_title/meta/tags

# Homepage  ── Fase 1 = SÓ LEITURA (escrita adiada)
GET    /api/ai/homepage                          get_homepage
# POST /api/ai/homepage/update  → ADIADO. Hoje não há flag de destaque em `articles`
#   (só hero_image_*/status); o mecanismo de destaque precisa ser definido antes
#   de liberar escrita. Risco alto de bagunçar a home — fica pra fase posterior.

# Radar (proxy fino pro radar já existente)
POST   /api/ai/radar/curador                     -> radar /agents/curador/run
POST   /api/ai/radar/investigador                -> radar /agents/investigador/run
POST   /api/ai/radar/redator                     -> radar /agents/redator/run
POST   /api/ai/radar/pipeline                    -> radar /pipeline/run-all

# Social
POST   /api/ai/social/generate                   gera posts (draft em social_posts)
POST   /api/ai/social/schedule                   agenda (status=scheduled)
# publish_social → NÃO existe pra agente. Publicar nas redes = humano confirma
#   (mesma regra da publicação de matéria). Agente no máximo deixa agendado.

# Comunidade — tabela real `mural_posts` (modera via coluna `moderation_status`)
GET    /api/ai/community                          list_community_posts (pendentes)
POST   /api/ai/community/approve|reject           set moderation_status

# Bazar — tabela real `bazar_items` (modera via coluna `status`)
GET    /api/ai/bazar                               list_bazar_posts
POST   /api/ai/bazar/approve|reject                set status

# Analytics
GET    /api/ai/analytics/daily                     resumo diário
GET    /api/ai/analytics/articles                  mais lidas
GET    /api/ai/analytics/searches                  termos populares
```

## 6. Componente 2 — `zimbanet-mcp` (cliente MCP local)

Novo diretório no repo `zimbanet-mcp/` (Python, igual ao radar), rodando **na máquina do Hermes** via stdio.

```text
zimbanet-mcp/
  server.py          # registra as tools, lê env (ZIMBANET_API_URL, AGENT_TOKEN)
  client.py          # httpx fino: chama /api/ai/* com Bearer
  tools/
    articles.py      # list_drafts, get_article, update_article, submit_review
    homepage.py
    radar.py         # run_curador, run_investigador, run_redator, run_pipeline
    social.py
    community.py
    bazar.py
    analytics.py
  schemas/           # JSON schemas das tools
  README.md          # como plugar no Hermes (config + token)
```

Cada tool MCP é uma casca: valida args → chama `client.post("/api/ai/...")` → devolve o JSON. **Zero lógica de negócio aqui** (fica no `/api/ai`).

Config no Hermes (exemplo): apontar pra `zimbanet-mcp` com env `ZIMBANET_API_URL=https://teste.zimbanet.com` e `AGENT_TOKEN=<token do agente>`.

## 7. Modelo de dados (novas tabelas)

```sql
-- token + permissões por agente
create table agents (
  id                  text primary key,            -- ex: 'editor_ia'
  name                text not null,
  type                text not null,                -- editor | seo | social | community | commercial | director
  token_hash          text not null,                -- hash do bearer (nunca o token cru)
  permissions         jsonb not null default '{}',  -- { "read": [...], "write": [...] }
  rate_limit_per_hour int not null default 120,     -- teto de chamadas/hora por agente
  active              boolean not null default true,
  last_used_at        timestamptz,                  -- última chamada (detectar agente parado / token vazando)
  revoked_at          timestamptz,                  -- se preenchido, token revogado → nega imediatamente
  created_at          timestamptz not null default now()
);

-- auditoria/execução de cada chamada de agente
create table agent_runs (
  id          uuid primary key default gen_random_uuid(),
  agent_id    text references agents(id),
  tool        text,        -- ex: 'update_article'
  action      text,        -- read | write
  resource    text,        -- ex: 'articles/<id>'
  status      text,        -- ok | denied | error
  detail      jsonb,
  tokens_in   int default 0,
  tokens_out  int default 0,
  cost_usd    numeric default 0,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
```

**Reaproveitar o que já existe** (não recriar): `audit_log` (auditoria geral), `agent_activity` (feed), `agent_commands` (fila de comandos — avaliar se serve aqui), `curator_rubric`, `editorial_personas`.

**Adiar (fases futuras):** `agent_memory`, `commercial_leads`, `editorial_reports` — só quando os agentes de comercial/relatório existirem.

RLS: as novas tabelas seguem o padrão do projeto — `*_admin_all` (`for all to authenticated using public.is_admin()`); o `/api/ai` lê/escreve via service role no servidor.

## 8. Modelo de permissões

`agents.permissions` (jsonb), escopos por recurso. Ex.:

```yaml
editor_ia:   { read: [articles, drafts, analytics], write: [article_content, article_metadata, homepage] }
seo_ia:      { read: [articles],                      write: [slug, seo_title, meta_description, tags] }
social_ia:   { read: [articles],                      write: [social_posts] }
community_ia:{ read: [community_posts, bazar_posts],  write: [moderation_status] }
director_ia: { read: [all],                           write: [] }
```

O `withAgent` checa o escopo antes de executar. `write` que não está no escopo → 403 + `agent_runs.status='denied'`.

## 9. Auditoria (obrigatória)

Toda chamada gera 1 linha em `agent_runs` (com tokens/custo quando aplicável) e, em ações de escrita, 1 entrada em `audit_log` (`entity_type`, `entity_id`, `action`, `actor=agent`, `agent=<id>`). Painel admin futuro: aba "Atividade dos agentes" lendo `agent_runs`.

## 10. O que já existe vs. o que falta

| Capacidade | Já existe? | Onde |
|---|---|---|
| Rodar curador/investigador/redator/pipeline | ✅ | radar `/agents/*`, `/pipeline/*` |
| Auditoria base | ✅ | `audit_log`, `agent_activity` |
| Personas, rubrica do curador | ✅ | `editorial_personas`, `curator_rubric` |
| Social posts, render de card | ✅ (parcial) | `social_posts`, `/api/social/render` |
| Comunidade/Bazar (dados) | ✅ | `mural_posts`, `bazar_items` |
| `/api/ai/*` (gateway) | ❌ | a criar |
| token/permissão por agente (`agents`) | ❌ | a criar |
| `agent_runs` (execução/custo) | ❌ | a criar |
| `zimbanet-mcp` | ❌ | a criar |

## 11. Fases de construção (quando o Rodrigo der o ok)

- **Fase 0 — Fundação:** tabelas `agents`/`agent_runs`, `withAgent` (auth+authz+audit), 1 rota de teste `/api/ai/ping`, e o `zimbanet-mcp` mínimo conectando.
- **Fase 1 — Fatia editorial:** `/api/ai/articles` (list/get/update/review) + `/api/ai/radar/*` + `/api/ai/analytics/daily`. Hermes já opera Editor/SEO em rascunho.
- **Fase 2 — Distribuição:** `/api/ai/social/*`, `/api/ai/homepage/*`.
- **Fase 3 — Comunidade/Bazar:** moderação.
- **Fase 4+ — Comercial/relatórios/memes:** tabelas e rotas próprias.

## 12. Decisões (revisão do Rodrigo — 2026-06-16)

1. ✅ Agente **nunca publica** — matéria E redes: só `submit_review` / `schedule`. Publicar é só humano no admin.
2. ✅ **MCP roda local** com o Hermes por ora (hospeda depois, se quiser agentes 24/7 sem o PC ligado).
3. ✅ Gateway em **`teste.zimbanet.com`** por enquanto.
4. ✅ **Rate limit por agente** já na fundação → coluna `rate_limit_per_hour` (default 120/h) + `last_used_at` + `revoked_at` no `agents`.
5. ✅ **Homepage = só leitura** na Fase 1; escrita adiada (não há flag de destaque em `articles` hoje).
6. ✅ **Nomes reais de tabela** fixados: comunidade = `mural_posts` (modera `moderation_status`) · bazar = `bazar_items` (modera `status`).

## 13. Fora de escopo (YAGNI por ora)
- AI Gateway como serviço separado (virou rotas no portal).
- `agent_memory`, `commercial_leads`, `editorial_reports` (fases futuras).
- Agentes em si (Hermes).
