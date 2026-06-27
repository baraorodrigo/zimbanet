# Spec — Fase 1: Blindagem + Destravar o agente

> Origem: auditorias 2026-06-20 (`docs/auditoria/*`). Validada pelo `revisor-produto` (nota 3/5 → corrigida abaixo) + topologia de prod verificada. Right-sized (portal de notícias com Supabase, sem domínio de dinheiro). A unificação de publicação (`canPublish`) é **Fase 2** — aqui NÃO se mexe na Fila.

## 1. Objetivo
Fechar os riscos baratos e **destravar o agente**, sem mexer em arquitetura. Depois desta fase: o Hermes volta a publicar/moderar/definir capa **sem 403**; nada perigoso vaza sozinho num restore de banco; e as bordas visíveis do leitor (mural) e as copys quebradas saem.

## 2. Regras de negócio
**Já definido:** fase de teste → o agente **publica** (autonomia total), via **escopos explícitos**. Notícia velha/sem foto não publica pelo caminho do agente (trava já existe em `/publish`). A Fila/edição continuam sem trava nesta fase (vira Fase 2). Right-sized.
**Decisão do dono:** ver §7.

## 3. Fluxo (o que muda) — CORRIGIDO pós-validação

1. **Permissões do agente** — o furo NÃO está no `agent-presets.ts` sozinho: o `scripts/seed-agent.ts` **não usa preset** — ele grava `type:'director'`, `permissions:{read:['all'], write:[]}` na unha. `read:['all']` já cobre `pauta`/`pendencias`/`community`/`bazar` (read). **Falta só o `write`.** Tarefa real:
   - (a) **Atualizar o agente VIVO em produção** (in-place, mantendo o token): `write:[article_content, slug, radar, publish, homepage, community, bazar]`. Sem recriar → o token do Hermes **não é invalidado**.
   - (b) Corrigir `seed-agent.ts` pra novos agentes nascerem com esses escopos (e/ou criar um preset nomeado `publisher` em `agent-presets.ts` e o seed selecioná-lo). Manter um preset `rascunho` (sem `publish`) pro futuro.
   - Recursos exigidos pelas rotas (verificado): write → publish (`/publish`,`/archive`,`/unpublish`), homepage (`/home`), community (`/community/moderate`), bazar (`/bazar/moderate`), radar (`/pauta/draft`,`/radar/*`); read (já cobertos por `all`) → pauta, pendencias, community, bazar.
2. **Kill-switch fail-closed** — `/api/ai/articles/[id]/publish` hoje só bloqueia se `value==='false'` (some a flag → publica). Passa a **exigir `value==='true'`** pra liberar; ausente/outro → 423. **Migration** com `INSERT ... ON CONFLICT (key) DO NOTHING` seedando `'true'` (não sobrescreve quem desligou na mão).
3. **Radar (defense-in-depth, baixa urgência — JÁ é privado)** — verificado em prod: `expose: 8100` (não `ports`), **sem Traefik**, `radar.zimbanet.com` não responde; só o portal o alcança via `radar:8100`. **NÃO fazer bind 127.0.0.1** (quebraria o DNS interno). Opcional: API key compartilhada (`RADAR_API_KEY` em env do radar + do portal; `radar.ts`/`client.py` mandam o header; `main.py` exige). Prioridade baixa — pode ir pra Fase 3.
4. **SSRF — DOIS vetores** — `src/lib/storage-images.ts:109` (`redirect:'follow'`) **e** `src/lib/scrape/article.ts:222` (scraper do `submit_url_to_radar`, mesmo problema). Em ambos: `redirect:'manual'` + revalidar cada hop com `assertSafeUrl`/checagem de host privado. `isPrivateHost` já existe e cobre IMDS/RFC1918.
5. **RBAC versionado** — `is_admin()` existe no banco (referenciada/alterada por migrations) mas **sem CREATE versionado** (restore quebra RLS do painel). Migration de reconciliação **idempotente**: `create or replace function is_admin()` (e `is_staff()` se usada em SQL — confirmar; hoje parece TS-only em `src/lib/auth/admin.ts`). **Não** recriar as policies (já existem) — só a função.
6. **Fuso BR** — bug está em `radar/app/sources/regional.py:138-153` (`parse_loose_dt`, `parse_br_dt`): gravam BRT como `tzinfo=UTC`. Usar `ZoneInfo('America/Sao_Paulo')` (já importado em `repositories.py` como `NEWS_TZ`). **NÃO** tocar `parse_iso` (já trata TZ explícita certo).
7. **Mural** — `src/app/zimbamilgrau/page.tsx`: ler `?bairro=` e passar pro `fetchMuralPosts` (já aceita `opts.bairro`, `community.ts:91`); botões de bairro viram `<Link>` (searchParam, server-side); "Carregar mais" → server-side simples (`?ate=N` aumentando o limite, sem estado client); remover o morto `[...posts,...posts,...posts]`.
8. **Copys** — `npm run curador` (em `/admin/pauta:620`, `/admin/fontes:87` + `form.tsx:270`) → trocar pela ação real (botões do Dashboard/Autônomo). WhatsApp placeholder `(48) 9 9999-9999` em `/pauta:35`.

## 4. Fora do escopo (Fase 2/3)
Unificar `canPublish()` + aposentar autopublish do radar; trava em approveArticle/publishBatch/updateArticle (Fila/edição); consolidar hero (6 caminhos); erro tipado + retry (costura TS↔Python); API key do radar pode cair aqui ou na Fase 3.

## 5. Critérios de aceite (testáveis)
- [ ] Agente com permissões atualizadas publica/arquiva/define capa/modera mural/bazar **sem 403** (E2E).
- [ ] Token do Hermes **continua válido** após o update (não recriado).
- [ ] Flag ausente/`!= 'true'` → `/publish` retorna **423** (fail-closed).
- [ ] Migration seeda `agent_autopublish_enabled='true'` com `ON CONFLICT DO NOTHING`.
- [ ] `storage-images` **e** `scrape/article`: URL pública que redireciona pra `169.254.169.254` → **bloqueia**.
- [ ] Migration cria `is_admin()` idempotente (roda 2x sem erro; policies intactas).
- [ ] Parser: fato **00:30 BRT** cai no dia certo (teste de borda); `parse_iso` intacto.
- [ ] `/zimbamilgrau`: bairro **filtra**; "Carregar mais" **traz mais**; sem código morto.
- [ ] `/admin/pauta` e `/admin/fontes` sem `npm run curador`; `/pauta` sem WhatsApp placeholder.
- [ ] `npm run lint` + `npm run build` verdes.

## 6. Tarefas (em fases)
**F1a — Destravar + bordas (P, baixo risco, direto):**
- [ ] Atualizar agente vivo (in-place) + corrigir `seed-agent.ts`/preset
- [ ] Mural: `?bairro` + "Carregar mais" server-side + remover morto
- [ ] Copys quebradas

**F1b — Segurança (À MÃO + revisão adversarial + gate do dono antes de deploy):**
- [ ] Kill-switch fail-closed + migration seed (ON CONFLICT DO NOTHING)
- [ ] SSRF nos 2 vetores (storage-images + scrape/article)
- [ ] Migration `is_admin()` (+ is_staff se SQL)
- [ ] Fuso BR (só `parse_loose_dt`/`parse_br_dt`) + teste de borda
- [ ] (opcional/baixa) API key do radar

## 7. Decisões do dono
1. **Autopublish padrão `'true'`** (seed) — recomendo SIM (fase de teste, com `ON CONFLICT DO NOTHING` pra respeitar desligamento manual). Confirma?
2. **Agente segue publicando sozinho nesta fase** — você reverteu pra autonomia total; confirmo que segue.
3. ~~Token invalida no deploy?~~ Resolvido: atualizo o agente **in-place** (token preservado).
4. ~~Radar exposto?~~ Resolvido: **privado** (só portal acessa); bind descartado.
5. ~~"Carregar mais" muda arquitetura?~~ Resolvido: server-side `?ate=N` (sem estado client).
