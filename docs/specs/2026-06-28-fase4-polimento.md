# Spec — Fase 4: Polimento (enxuta)

> Origem: auditorias 2026-06-20 + revisão adversarial da Fase 3. Defesa-em-profundidade + saúde do código + UX. Right-sized — NÃO virar catedral. Escopo aprovado pelo dono: **(1) distribuidor idempotente, (2) mensagens de erro amigáveis, (3) quebrar o media-studio.ts**. Fora: API key do radar, consolidar hero, skeleton, prompt do Hermes (ficam pra depois).

## 1. Objetivo
Fechar o último risco de duplicação (post social), fazer o painel **mostrar o porquê** quando barra uma ação, e quebrar o único god-file pra o sistema evoluir sustentável — tudo sem mudar comportamento de sucesso.

## 2. Itens

### Item 1 — Distribuidor idempotente (defesa-em-profundidade)
**Problema:** `radar/app/agents/distribuidor.py:252` faz `sb.table("social_posts").insert(rows)` puro. Não há `unique (article_id, channel)` (só índice não-único `ix_social_posts_article`). Re-rodar o distribuidor (finalize/redistribuir) ou um caminho futuro pode criar **linhas duplicadas** → post social repetido.

**Regras de negócio:**
- Nunca pode existir mais de uma linha de `social_posts` pro mesmo `(article_id, channel)`.
- Re-rodar o distribuidor **atualiza** o conteúdo do post pendente em vez de duplicar.
- **Posts já enviados não são ressuscitados** (não resetar `status` de um post que saiu de `pending`). ⚠️ regra-chave.
- Dados existentes em prod podem já ter duplicatas → a migration **deduplica antes** de criar a constraint (senão o ALTER falha).

**Fluxo:**
1. Migration: deduplica `social_posts` mantendo 1 linha por `(article_id, channel)` (a mais recente por `created_at`); cria `unique (article_id, channel)`.
2. `distribuidor.py`: troca o `insert` por uma escrita idempotente que **não mexe em post já enviado** (ver §6 Decisão 1 — abordagem definida no build após ler o caminho de redistribuir).

### Item 2 — Mensagens de erro amigáveis (UX)
**Problema:** `src/lib/actions/articles.ts` — `approveArticle` (`throw new Error(chk.motivo)` na linha ~322) e `publishArticle` lançam erro cru. Em produção o Next mascara isso num boundary genérico ("An error occurred…") → o motivo do `canPublish` ("sem foto") **some** pra quem usa a Fila/tela de matéria.

**Regras de negócio:**
- Quando uma ação do painel é barrada (sem foto, sem permissão, fonte não-de-hoje), o **motivo claro** aparece pra quem clicou.
- Não muda quem PODE publicar (a regra `canPublish` é a mesma); muda só **como o erro é mostrado**.

**Fluxo:**
1. `approveArticle`/`publishArticle` passam a **retornar** `{ ok, error? }` em vez de `throw` nos erros de regra (mantêm `throw` só pra falha inesperada de infra).
2. Os chamadores (Fila `page.tsx`, `materias/[id]/page.tsx`) renderizam o `error` (toast/inline), espelhando o que a `FilaBulkBar` já faz com `{blocked}`.

### Item 3 — Quebrar o media-studio.ts (saúde do código)
**Problema:** `src/lib/actions/media-studio.ts` = **1157 linhas**, 19 funções — único god-file (auditoria: resto do código é são). Difícil de evoluir sem quebrar.

**Regras de negócio:**
- **Refator puro: ZERO mudança de comportamento.** Só reorganização.
- Os imports existentes (`from "@/lib/actions/media-studio"`) **continuam funcionando** (barrel re-exporta) — não tocar nos ~14 chamadores.

**Fluxo (split por tema, cada um `"use server"`):**
- `media-studio/hero.ts` — applyAsArticleHero, refreshArticleHeroFromSource, scrapeOgImage, absolutize, setArticleHeroFromUrl, uploadArticleHeroFromForm.
- `media-studio/variations.ts` — generateVariations, generateHeroVariations, applyVariation, fetchSourceImage.
- `media-studio/social-kit.ts` — templateRouteForFormat, originForRender, applySocialKitTemplate, applySocialKitTemplateToPost, generatePack.
- `media-studio/social-media.ts` — applyHeroToAllSocialPosts, uploadMediaFromForm, clearPostMedia.
- `media-studio/shared.ts` — requireStaff + tipos/constantes compartilhados.
- `media-studio.ts` vira **barrel** que re-exporta tudo (compatibilidade).

## 3. Fora do escopo
API key do radar; consolidar os caminhos de hero num único `setArticleHero`; skeleton/Suspense no leitor; instalar o prompt anti-falso-alarme no Hermes. Tornar OUTRAS escritas idempotentes além do distribuidor.

## 4. Critérios de aceite (testáveis)
- [ ] Migration deduplica e cria `unique (article_id, channel)`; rodar 2x o distribuidor no mesmo artigo **não** cria 2ª linha por canal; post já enviado **não** volta a `pending`.
- [ ] `npm run build` + `lint` verdes; `py_compile`/`pytest` (área) verdes.
- [ ] `approveArticle`/`publishArticle` retornam `{ok,error}`; a Fila/tela de matéria **mostram** o motivo ("sem foto") em vez de tela de erro genérica.
- [ ] media-studio quebrado em módulos; **todos os imports antigos resolvem** (build prova); nenhuma assinatura de função mudou; comportamento idêntico.
- [ ] Revisão adversarial sem graves: refator preserva comportamento; migration não perde dado bom; idempotência não ressuscita enviado.

## 5. Tarefas
- [ ] Item 1: migration dedup+unique + distribuidor idempotente
- [ ] Item 2: actions retornam resultado + chamadores renderizam
- [ ] Item 3: split do media-studio em módulos + barrel
- [ ] Verificar (build/lint/pytest) → revisão adversarial → gate do dono → deploy c/ rollback (migration aplicada à mão)

## 6. Decisões em aberto / a definir no build
1. **Abordagem da idempotência do distribuidor:** após ler o caminho de "redistribuir", escolher entre (a) `upsert` on_conflict `(article_id, channel)` atualizando só conteúdo de pendentes, ou (b) deletar pendentes do artigo e re-inserir. Critério: **não ressuscitar post enviado**. (Recomendação inicial: deletar só os `pending` do artigo antes de inserir — simples e respeita enviados.)
2. **Ordem de deploy:** migration (dedup+unique) aplicada à mão ANTES do código novo do distribuidor, pra constraint existir quando o código idempotente rodar.
