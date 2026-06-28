# Spec — Fase 3: Resiliência da costura TS↔Python + limpeza

> Origem: auditorias 2026-06-20 (causa-raiz #5: "costura TS↔Python frágil sem observabilidade → Hermes lê erro transitório como infra caída e alarma o dono à toa"). Right-sized. Escopo enxuto: resiliência + remover o código morto do autopublish. Refactors maiores (media-studio, consolidar hero, API key do radar, UX do throw) ficam pra depois.

## 1. Objetivo
Fazer o sistema **degradar com graça** quando o motor (radar) demora ou falha temporariamente, em vez de o erro virar "token/MCP/portal caiu" na cara do agente. Concretamente: **retry com backoff** em falha transitória e **erro tipado/claro** ("temporário, tente de novo" vs "erro real"), nas duas pontas (gateway→radar e MCP→gateway). E **deletar o código morto** do autopublish do radar (deixado na Fase 2).

## 2. Regras de negócio
- **Transitório** (retry, NÃO é "caiu"): timeout/AbortError, 502/503/504, ECONNRESET / falha de rede. Quase sempre passa na 2ª tentativa.
- **Estrutural** (não retry; é erro real): 4xx (exceto 408/429), JSON inválido de resposta 2xx, erro de lógica.
- A mensagem final de uma falha **transitória** deve dizer claramente que é **temporária** (pra o agente não ler como infra caída).
- Não muda comportamento de sucesso. Sem domínio de dinheiro.

## 3. Fluxo (o que muda)
1. **`src/lib/radar.ts` (gateway → radar):** `radarFetch` passa a:
   - classificar a falha: timeout/abort/5xx/rede = **transitória**; 4xx = **estrutural**.
   - **retry** em transitória: 2 tentativas extras com backoff (ex.: 400ms, 1200ms).
   - lançar **erro tipado** `RadarError` com `{ transient: boolean }` e mensagem clara; em transitória esgotada: "motor temporariamente indisponível (timeout/5xx) — tente de novo em instantes" (NÃO "token/MCP").
2. **`zimbanet-mcp/client.py` (MCP → gateway):** `get`/`post` passam a:
   - **retry** em transitória (httpx Timeout/ConnectError, 502/503/504): 2 tentativas com backoff.
   - na falha transitória esgotada, mensagem clara de "temporário, tente de novo" (não infra caída).
3. **Limpeza (código morto da Fase 2):** remover de `radar/app/db/repositories.py`: `publish_article`, `fetch_drafts_for_autopublish`, `_parse_db_datetime`, `_source_published_at_by_scored_item`, `_is_today_in_news_tz` (sem chamador desde a Fase 2) + imports órfãos (`ZoneInfo`/`NEWS_TZ` se ficarem sem uso). Confirmar com grep que nada mais chama.

## 4. Fora do escopo (Fase 4)
Quebrar `media-studio.ts`; consolidar os 6 caminhos de hero num `setArticleHero` único; API key do radar (defense-in-depth); converter o `throw` cru de publishArticle/approveArticle em mensagem amigável na tela; instalar o prompt anti-falso-alarme no perfil do Hermes.

## 5. Critérios de aceite (testáveis)
- [ ] `radarFetch`: numa falha transitória simulada (mock que falha 1x e acerta na 2ª), retorna sucesso após retry. Numa transitória persistente, lança `RadarError {transient:true}` com mensagem de "temporário".
- [ ] `radarFetch`: numa falha estrutural (4xx), NÃO faz retry e lança erro estrutural.
- [ ] `client.py`: retry em httpx.TimeoutException/502; sem retry em 4xx.
- [ ] Tempo total com retries respeita o timeout (não estoura o clique).
- [ ] `repositories.py`: `publish_article`/`fetch_drafts_for_autopublish`/helpers removidos; `grep` não acha referência; `py_compile`/`pytest` ok; sem import órfão.
- [ ] `npm run lint` + `npm run build` + `pytest` verdes.

## 6. Tarefas
- [ ] `radarFetch` com classificação + retry/backoff + `RadarError` tipado
- [ ] `client.py` com retry/backoff em transitória
- [ ] Remover código morto do autopublish (repositories.py) + imports órfãos
- [ ] Verificar + revisão adversarial + gate + deploy c/ rollback

## 7. Decisões do dono
1. **Retry: 2 tentativas extras** (total 3) com backoff curto. Ok? (mais que isso prende o clique demais.)
2. Mensagem de transitório clara pro agente ("temporário, tente de novo") — confirma a abordagem (vs instalar o prompt anti-falso-alarme, que fica pra Fase 4).

## 8. Ajuste pós-revisão adversarial (segurança > retry agressivo)
A revisão pegou um risco real de **idempotência**: retentar uma operação que pode ter executado (ex.: distribuidor inserindo `social_posts`) **duplicaria** post social. Decisão final, mais segura que a original:
- **`radar.ts`: NÃO retenta** automaticamente (várias chamadas do radar não são idempotentes). Mantém só o **erro tipado + mensagem clara** de "momentâneo".
- **`client.py`: retenta APENAS `ConnectError`** (a conexão nem abriu → request não foi enviada → 100% seguro). Timeout / resposta-perdida (ReadError/RemoteProtocolError) / 5xx → **sem retry**, só mensagem clara (a operação pode ter rodado).
- **`withAgent` propaga a `RadarError`** (a mensagem "momentâneo, não é o token" agora chega ao agente; antes virava "erro interno" genérico nas rotas radar/[agent] e submit-url).
- Resultado: o valor central (o agente para de ler erro transitório como "infra caída") vem da **mensagem clara**; o retry é um bônus seguro só onde não há como duplicar. Tornar o distribuidor idempotente (unique `(article_id, channel)`) fica pra Fase 4 como defesa-em-profundidade.
