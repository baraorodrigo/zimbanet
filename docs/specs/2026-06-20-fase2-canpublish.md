# Spec — Fase 2: `canPublish()` — uma fonte de verdade pra publicação

> Origem: auditorias 2026-06-20 (risco #1) + revisão adversarial do Bloco B (confirmou que a trava de recência humana só está em `publishArticle`; Fila e edição passam direto). Right-sized. Sensível (mexe em publicação) → construir À MÃO + revisão adversarial + gate do dono.

## 1. Objetivo
Acabar com a regra "pode publicar?" espalhada e divergente. Hoje a decisão (tem fonte? tem foto? é de hoje?) vive em pedaços em ~5 lugares com lógicas diferentes — por isso notícia velha/sem foto ainda sobe pela **Fila** (o caminho mais usado). Criar **uma** regra pura e testável, usada por **todos** os caminhos de publicação, e **aposentar o 2º publicador** (autopublish do radar).

## 2. Regras de negócio
**A regra de conteúdo `canPublish` (já definida pelas fases anteriores):** uma matéria só pode ir ao ar se:
1. **Tem foto** de capa (`hero_image_url`).
2. **Tem fonte rastreável** (`scored_item_id` OU `source_url`) — não é texto "de cabeça".
3. **É recente**: se dá pra saber a data da fonte (via `scored_item` → `raw_item.published_at`), ela tem que ser **de hoje** (fuso `America/Sao_Paulo`). Se **não dá pra saber a data** (só `source_url`, ou sem data) → **passa** na recência (não dá pra afirmar que é velha; foto+fonte seguem obrigatórias).

**Fora da regra de conteúdo (cada caminho mantém o seu):**
- **Status válido** (rascunho/revisão/agendada) — é transição, não conteúdo; cada caminho checa o seu.
- **Interruptor `agent_autopublish_enabled`** (kill-switch) — é gate só do agente, fica na rota do agente, antes do `canPublish`.

**Decisão do dono (ver §7):** a Fila passa a **bloquear** matéria que falha o `canPublish` (em vez de publicar). Confirmar.

## 3. Fluxo (o que muda)
1. **Novo módulo `src/lib/rules/article-publish.ts`:**
   - `evaluatePublish(input) → { ok: true } | { ok: false, motivo }` — **PURO** (sem banco), recebe `{ heroImageUrl, sourceUrl, scoredItemId, sourceIsToday }`. Testável por tabela.
   - `checkCanPublish(sb, articleId) → { ok, motivo }` — busca os campos da matéria + calcula `sourceIsToday` (reusa `recency.sourceIsFromTodayByScoredId`) e chama `evaluatePublish`.
2. **Plugar nos caminhos (todos):**
   - `approveArticle` (Fila): antes do update, `checkCanPublish` → se `!ok`, retorna/lança erro amigável (não publica).
   - `publishBatch` (Fila lote): dentro do loop, **pula** os bloqueados (conta e reporta), **não aborta o lote**.
   - `publishArticle` (matéria): troca o guard inline atual por `checkCanPublish`.
   - `updateArticle` (quando `goingLive`): aplica `checkCanPublish`; retorna `{ ok:false, error }` amigável (já é `ActionResult`).
   - Rota do agente `/api/ai/articles/[id]/publish`: troca os checks inline de fonte/foto por `checkCanPublish` (mantém o kill-switch antes). Recência passa a valer aqui também.
3. **Aposentar o 2º cérebro:** deletar `_autopublish_tick` (`radar/app/scheduler.py`) e `publish_article` (`radar/app/db/repositories.py`) + o job no scheduler. O radar **não publica** mais — só o gateway/painel, via `canPublish`. (Já está desligado por flag; isto remove o caminho morto e o risco de religar.)
4. **Completar o fuso:** `extract_jsonld_date` (`radar/app/sources/regional.py`) — aplicar `BR_TZ` a data naive, como os outros parsers (fechar o off-by-one raro que a revisão do Bloco B achou).

## 4. Fora do escopo (Fase 3)
Erro tipado + retry na costura TS↔Python; quebrar `media-studio.ts`; consolidar os 6 caminhos de hero; Suspense/skeleton no leitor; API key do radar.

## 5. Critérios de aceite (testáveis)
- [ ] `evaluatePublish`: testes de tabela — sem foto → bloqueia; sem fonte → bloqueia; `sourceIsToday=false` → bloqueia; `sourceIsToday=null` (sem data) + foto + fonte → passa; tudo ok → passa.
- [ ] **Fila** (`approveArticle` e `publishBatch`): matéria sem foto / de fato antigo → **não publica** (lote pula o item, não derruba os outros).
- [ ] `updateArticle` com mudança pra `published` e fonte velha → `{ ok:false }` com mensagem clara.
- [ ] Rota do agente `/publish`: mesma regra (foto+fonte+recência) via `canPublish`; kill-switch continua valendo antes.
- [ ] Radar: `_autopublish_tick`/`publish_article` removidos; `grep` não acha mais referência; build/import do radar ok.
- [ ] `extract_jsonld_date`: data naive vira BR_TZ (teste de borda 00:30).
- [ ] `npm run lint` + `npm run build` + `pytest` verdes.

## 6. Tarefas (fases)
- [ ] `evaluatePublish` puro + testes de tabela
- [ ] `checkCanPublish` (wrapper com banco + recência)
- [ ] Plugar: agente `/publish`, `publishArticle`, `approveArticle`, `publishBatch`, `updateArticle`
- [ ] Aposentar autopublish do radar (`_autopublish_tick` + `publish_article` + job)
- [ ] `extract_jsonld_date` BR_TZ + teste
- [ ] Verificar + revisão adversarial + gate + deploy c/ rollback

## 7. Decisões do dono
1. **A Fila passa a BLOQUEAR** matéria sem foto / velha (hoje publica). Recomendo **sim** — é o objetivo. (No lote, os bons publicam e os barrados são pulados com aviso.)
2. **Recência "só de hoje"** continua valendo (definido na Fase 1). Mantém?
3. **Aposentar o autopublish do radar** de vez (deletar o código morto). Recomendo **sim** (já está off; tira o risco de religar e a confusão dos "2 cérebros").
