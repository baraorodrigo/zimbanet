# Auditoria de Estado — ZIMBANET

> Auditoria IS-vs-SHOULD (como o código é × como deveria ser), veredito por peça, revisada adversarialmente (2º cético refutando cada achado). Data: 2026-06-20. Benchmark right-sized (portal de notícias, sem catedral).

**Resumo:** 77 componentes avaliados — **0 reconstruir · 38 refatorar · 39 manter**. 36 issues confirmados · 22 achados derrubados pelo cético.


## Onde estamos

O ZIMBANET está funcional e no ar: o site público lê e exibe notícias, mural e bazar com tratamento de erro decente, o painel admin dá ao Rodrigo o ciclo editorial completo (pauta, fila, capa, social), o motor de IA coleta/triagem/redige e o agente Hermes opera via gateway com autenticação sólida. O código é, em geral, limpo e pragmático por componente — não há catedral nem god-files generalizados (só o media-studio.ts de 1157 linhas destoa). O problema central não é qualidade local de código, e sim ARQUITETURA DE REGRAS: a decisão 'pode publicar esta notícia?' (tem fonte? tem foto? é de hoje? status válido?) está espalhada em 4+ lugares com lógicas divergentes, sem nenhum módulo único testável — foi exatamente isso que deixou notícia velha e matéria 'de cabeça' vazarem, e por que cada correção virou remendo num canto novo. Existem DOIS cérebros de publicação (radar Python, desligado mas religável por env, com travas mais fracas; e o agente TS, vivo e mais rigoroso) que podem divergir. Há riscos de segurança reais e baratos de fechar (kill-switch de autopublish fail-open e não versionado, SSRF burlável por redirect, radar FastAPI sem auth, função is_admin() não versionada que quebra o RBAC num restore). No geral: NÃO é candidato a reconstrução — é um sistema bom o bastante que precisa de consolidação cirúrgica de regras + alguns reforços de segurança para evoluir de forma sustentável.


## Causas-raiz (o problema de fundo, não o sintoma)

- REGRAS DE NÚCLEO ESPALHADAS, SEM DONO ÚNICO: a decisão 'pode publicar?' (fonte/foto/recência/status) vive inline em 4+ caminhos (approveArticle, publishBatch, publishArticle, rota /publish do agente, draft, radar Python) com lógicas divergentes e ZERO teste — confirmado: src/lib/rules/ não existe. É a causa-raiz direta de 'notícia velha vazou' e do efeito 'remendo em vários cantos e ainda escapava'. Falta um canPublish(article)→{ok,motivo} puro e testável usado por TODOS.
- DOIS CÉREBROS DE PUBLICAÇÃO (TS vivo + Python dormente): o radar tem autopublish_tick/publish_article com travas mais fracas (publica sem foto e sem source_url), desligado por flag default-False mas RELIGÁVEL por um único env errado. Mantém confusão conceitual ('qual lado é a verdade?') e risco de divergência. A verdade canônica é o TS; o motor Python de publicação deve ser aposentado.
- BURACO ESTRUTURAL NA RECÊNCIA (acoplada ao radar): a checagem 'é de hoje?' só resolve via scored_item_id→raw_item.published_at; matéria criada só com source_url (fonte manual) passa na trava de fonte e PULA 100% a recência. 'Sem data' também passa. Some-se a isso o bug de fuso nos parsers Python (BRT gravado como UTC) que pode rejeitar matéria legítima da madrugada na trava viva do TS.
- SEGURANÇA NÃO VERSIONADA / FAIL-OPEN: os freios mais importantes não são à prova de restauração — o kill-switch de autopublish é fail-open e não está em nenhuma migration (DB novo = agente pode publicar sozinho), e is_admin()/is_staff() (que sustentam o RBAC do painel) não têm create function versionado. Um restore quebra controle de acesso e/ou solta a publicação autônoma silenciosamente.
- COSTURA TS↔PYTHON FRÁGIL E SEM OBSERVABILIDADE: o erro do radar é repassado como string plana e o gateway decide status por regex no texto da exceção; timeout transitório vira 502 sem retry. É a raiz do sintoma 'Hermes lê erro transitório como infra caída e alarma o dono à toa'. Falta erro tipado (transitório vs estrutural) + retry/backoff + classificação de falha de fonte.

## Top riscos (perigoso agora)

- FAIL-OPEN do kill-switch de autopublish: a flag agent_autopublish_enabled não é seedada em nenhuma migration; em DB novo/restaurado/linha apagada a condição não bloqueia e o agente PUBLICA sozinho. É o pior cenário (publicação autônoma sem ninguém ligar) e o fix é ~1h.
- Publicação na Fila SEM nenhuma trava no servidor: approveArticle faz UPDATE status='published' só por id (sem checar status atual, fonte, foto ou recência) — pode republicar matéria já rejeitada/arquivada e deixar passar matéria 'de cabeça' e velha. É o caminho de MAIOR volume do dono e o menos protegido.
- Recência burlável por source_url: matéria com fonte manual (sem scored_item_id) escapa 100% da trava anti-notícia-velha mesmo no caminho do agente. É exatamente a porta por onde 'notícia velha vazou'.
- SSRF burlável: downloadAndStoreImage valida só a URL original e segue redirects (redirect:'follow'), e checa hostname e não o IP resolvido — URL pública que redireciona pra 169.254.169.254 (metadados de cloud) ou IP interno passa, rodando com service_role. Vetor real via raw_items.image_url raspado.
- Radar FastAPI sem autenticação em 0.0.0.0:8100: qualquer um que alcance a porta dispara pipeline, submit-url (SSRF via scraper Python sem proteção) e, se autopublish ligado, publica — ignorando todo o RBAC do gateway TS.
- is_admin()/is_staff() não versionadas: um restore/migration limpa deixa as policies referenciando função inexistente e derruba o RBAC do painel silenciosamente (build verde mascara).
- Bug de fuso nos parsers Python (BRT→UTC): published_at da madrugada (00:00-02:59 BRT) desloca pro dia anterior e a trava VIVA do TS pode rejeitar matéria legítima como 'velha'.

## Mapa de decisão por subsistema


### Site público (leitor)
- **Refatorar:** getHomepageData (extrair curadoria pura + teste); #zimbamilgrau (ligar filtro de bairro, load-more real, tirar trending mock); #bazardazimba (passar searchParams ao fetch — filtro hoje é em memória sobre teto de 60); relativeTime/initials (extrair p/ util compartilhado); fallback de body vazio (vaza 'Content Engine/pipeline/modo demo' pro leitor)
- **Manter:** Home page.tsx; Editoria page; Article page; fetchPublished; Sidebar (resiliência por-fonte); NewsCard/HeroSplit; PostCard; BreakingBar; MobileMenu; slugFromLabel

### Painel admin (cockpit)
- **Refatorar:** approveArticle/publishBatch/publishArticle (chamar canPublish() central); media-studio.ts (quebrar em 3 arquivos); Dashboard (esconder controles de pipeline técnico do dono não-dev); Fila (mostrar badge de idade/recência da fonte); Pauta (linked articles via RPC quando crescer)
- **Manter:** Páginas Pauta/Fila/Matérias; Editor de matéria; Capa do portal; Social (transições de estado); Ticker; Agentes (tokens); sources.ts; Layout/Header/Sidebar admin

### Motor de IA (radar Python)
- **Refatorar:** autopublish_tick + publish_article (APOSENTAR — segundo cérebro morto); parsers de data regionais (bug de fuso BRT→UTC afeta trava viva do TS); update_source_run (separar falha transitória de estrutural); trava de idade na entrada (coleta/Curador); scheduler trigger síncrono + global privado; repositories.py (anti-joins client-side, sem transação article+audit)
- **Manter:** Pipeline de agentes (Curador→Investigador→Redator→Revisor→Visual→Distribuidor); LLM client (call_with_tool); Adapters de scraping regional (reforçar com observabilidade, não reescrever)

### Gateway IA + MCP + Hermes
- **Refatorar:** recency.ts (extrair canPublish() puro; cobrir caminho source_url); rota /publish e /pauta/draft (rota fina chamando regra central); radar.ts + client.py (erro tipado + retry, parar de mapear erro por regex no texto); kill-switch autopublish (inverter p/ fail-closed + seedar migration); rota POST /articles (editoria inválida não pode cair calada em 'cidade'); agent-presets (preset 'publisher' explícito + mostrar escopos no painel)
- **Manter:** withAgent (auth+rate-limit+auditoria); tokens.ts/permissions.ts; downloadAndStoreImage (robusto; só fechar redirect SSRF); rotas finas update/seo/review/hero/archive/unpublish/home; MCP Server (docstrings como guard-rails); GET /api/ai/pauta

### Segurança & integridade (transversal)
- **Refatorar:** Kill-switch autopublish fail-open (CRÍTICO — inverter + seedar); is_admin()/is_staff() não versionadas (restore quebra RBAC do painel); SSRF por redirect/DNS-rebinding em downloadAndStoreImage; Radar FastAPI sem auth, bind 0.0.0.0:8100 (shared secret + bind local); Travas de publicação espalhadas e burláveis (canPublish central); RLS: transação article+audit, retenção de raw/scored
- **Manter:** Postura geral de RLS (anon só lê published); Trigger de imutabilidade do audit_log; Modelo de token (hash sha256, 192 bits, timing-safe)

## Quick wins (alto impacto, baixo esforço)

- **[P]** (Segurança) Inverter kill-switch para fail-closed (só 'true' libera) + migration seedando a flag — _alto_
- **[P]** (Site público) Trocar o fallback de body vazio que vaza 'Content Engine/pipeline/modo demo' por mensagem neutra ('conteúdo em atualização') e bloquear publish sem corpo — _alto_
- **[P]** (Site público) Ligar filtros de bairro do #zimbamilgrau (Link ?bairro=X — backend já aceita) e remover/realizar o 'Carregar mais' e o trending mock — _alto_
- **[P]** (Site público) Passar searchParams (type/cat/q) ao fetch do #bazardazimba para não filtrar em memória sobre teto de 60 — _medio_
- **[P]** (Painel admin) Badge de idade/recência da fonte no card da Fila (recency.ts já expõe sourceAgeDaysByScoredId) — _alto_
- **[P]** (Painel admin) Esconder os 5 botões de pipeline técnico do dashboard atrás de <details> 'Avançado' ou mover pra /admin/autonomo — _medio_
- **[P]** (Motor de IA) Corrigir parsers de data BR com ZoneInfo('America/Sao_Paulo') nos 2 parsers + caso de teste de borda da madrugada — _alto_
- **[P]** (Site público) Extrair relativeTime() e initials() para src/lib/time.ts e string-utils (matar 3 cópias divergentes) — _baixo_

## Roadmap (right-sized, rumo à versão ideal)


### Fase 1 — Blindagem (esta semana, ~P) — Fechar os riscos perigosos AGORA com fixes pequenos e localizados, sem mudar arquitetura. O dono volta a confiar que nada perigoso vaza sozinho.
- Kill-switch fail-closed + migration de seed
- Versionar is_admin()/is_staff() em migration de reconciliação
- Fechar SSRF (redirect:'manual' + checar IP resolvido) no downloadAndStoreImage
- Auth por shared secret no radar FastAPI + bind 127.0.0.1
- Corrigir bug de fuso nos parsers de data BR
- Quick wins de leitor: fallback de body, filtros do mural/bazar, badge de idade na Fila

### Fase 2 — UMA fonte de verdade para publicação (1-2 semanas, M) — Criar src/lib/rules/article-publish.ts com canPublish(article)→{ok,motivo} puro e testável (fonte+foto+recência+status, cobrindo TAMBÉM source_url e tratando 'sem data' como política explícita). Plugar em TODOS os caminhos: approveArticle, publishBatch, publishArticle, rota /publish e /pauta/draft. Suite de testes de borda. Aposentar o autopublish do radar Python (deletar tick + publish_article). Resultado: regra muda em 1 lugar só, fim do 'remendo em vários cantos' e dos dois cérebros.
- Módulo puro canPublish() + testes de tabela
- Rotas/actions viram finas (validam→chamam regra→devolvem)
- Cobrir caminho source_url na recência
- Deletar autopublish_tick/publish_article do radar
- Trava de idade na ENTRADA (coleta/Curador) para não gastar Sonnet com velho

### Fase 3 — Resiliência, observabilidade e polimento (M, contínuo) — Costura TS↔Python confiável e UX consistente. O agente para de alarmar à toa e o sistema degrada com graça. Limpeza tática sem over-engineering.
- Erro tipado (transitório vs estrutural) + retry/backoff em radar.ts e client.py
- Classificar falha de fonte (transitório não infla error_count) + alerta '0 itens há N dias'
- Quebrar media-studio.ts em image-provider/apply/storage
- Suspense+skeleton nas páginas leitor force-dynamic
- Transação article+audit no radar; retenção de raw/scored; RPC para anti-joins quando crescer
- Preset 'publisher' explícito + escopos visíveis no painel; busca/UI de auditoria

## Issues confirmados (36)

| Sev | Área | Issue | Arquivo |
|---|---|---|---|
| critico | Painel admin (cockpit) | Trava anti-notícia-velha NÃO existe no caminho principal de publicação (Fila) | `src/lib/actions/articles.ts:290-388` |
| critico | Painel admin (cockpit) | Regras de publicação espalhadas em 3 conjuntos divergentes, sem módulo único | `src/lib/actions/articles.ts + src/app/api/ai/articles/[id]/publish/route.ts` |
| critico | Motor de IA (radar Python) | Regra de recência do radar é CÓDIGO MORTO em produção (dois cérebros) | `radar/app/db/repositories.py:428-479 + radar/app/scheduler.py:196-253 + radar/app/config.py:39 (vs src/app/api/ai/articles/[id]/publish/route.ts + src/lib/ai/recency.ts)` |
| critico | Seguranca & integridade de dados (transversal) | Kill-switch de autopublish é FAIL-OPEN e não é seedado no schema | `src/app/api/ai/articles/[id]/publish/route.ts:27` |
| alto | Site publico (leitor) | Filtros de bairro do #zimbamilgrau são botões mortos e 'Carregar mais' é stub (UI promete, não entrega) | `src/app/zimbamilgrau/page.tsx:129-141, 175-178` |
| alto | Site publico (leitor) | Filtro/busca do #bazardazimba roda em memória sobre teto de 60 itens — resultado fica ERRADO ao crescer | `src/app/bazardazimba/page.tsx:65,78-86` |
| alto | Painel admin (cockpit) | approveArticle publica sem checar status atual — pode republicar rejeitada/arquivada | `src/lib/actions/articles.ts:298-307` |
| alto | Painel admin (cockpit) | Nenhum caminho do painel checa 'tem fonte' e 'tem foto' no servidor — só o agente checa | `src/lib/actions/articles.ts:290-558 vs src/app/api/ai/articles/[id]/publish/route.ts:51-75` |
| alto | Motor de IA (radar Python) | Bug de fuso nos parsers de data: BRT marcado como UTC — afeta a trava VIVA do TS | `radar/app/sources/regional.py:138-153 (parse_loose_dt/parse_br_dt); persiste em raw_items.published_at; consumido por src/lib/ai/recency.ts` |
| alto | Motor de IA (radar Python) | Falha transitória de fonte marca a fonte como 'erro' e infla error_count | `radar/app/sources/runner.py:104-114 + radar/app/db/repositories.py:55-75` |
| alto | Motor de IA (radar Python) | Sem trava de idade na entrada (coleta/Curador) — notícia velha chega à Pauta e gasta Sonnet | `radar/app/sources/runner.py:137-198 (submit_manual_url) + radar/app/agents/curador.py + insert_scored_item` |
| alto | Gateway IA + MCP + agente | Trava de recência tem buraco: matéria com source_url (sem scored_item_id) escapa da checagem de notícia-velha | `src/app/api/ai/articles/[id]/publish/route.ts:51-89 + src/lib/ai/recency.ts:58-66` |
| alto | Gateway IA + MCP + agente | Regras de núcleo (fonte/foto/recência/status) embutidas nas rotas e sem função pura testável — não há canPublish() | `src/app/api/ai/articles/[id]/publish/route.ts:40-89 + src/app/api/ai/pauta/[id]/draft/route.ts:24-34` |
| alto | Seguranca & integridade de dados (transversal) | SSRF burlável por redirect e DNS-rebinding no download de imagem | `src/lib/storage-images.ts:84,109` |
| alto | Seguranca & integridade de dados (transversal) | Recência burlável: source_url pula 100% a trava de notícia-velha | `src/app/api/ai/articles/[id]/publish/route.ts:51-89 + src/lib/ai/recency.ts:29,58` |
| alto | Seguranca & integridade de dados (transversal) | Radar FastAPI sem autenticação, exposto em 0.0.0.0:8100 | `radar/app/main.py:36-40 + radar/Dockerfile:26` |
| alto | Seguranca & integridade de dados (transversal) | Dois cérebros de publicação com travas divergentes (radar Python publica sem foto/fonte) | `radar/app/db/repositories.py:428-479 + radar/app/scheduler.py:325-333` |
| alto | Seguranca & integridade de dados (transversal) | is_admin()/is_staff() não versionadas — restore quebra o RBAC do painel | `supabase/migrations/0001_agents.sql:34-35` |
| alto | UX (site leitor + painel dono) transversal | Jargao interno de bastidor vaza pro leitor em materia sem corpo | `src/app/[editoria]/[slug]/page.tsx:303-307` |
| alto | UX (site leitor + painel dono) transversal | Controles falsos/quebrados no #zimbamilgrau (voz do povo) | `src/app/zimbamilgrau/page.tsx:129-140, 175, 108+212` |
| medio | Site publico (leitor) | Posts/comentários do mural entram com moderation_status='approved' direto — leitor vê conteúdo público sem revisão prévia | `src/lib/actions/community.ts:113,147 (e comentários 355,397 não verificados nesta passada)` |
| medio | Site publico (leitor) | relativeTime() triplicado e já divergente entre home e comentários do mural | `src/lib/db/articles.ts:26-37 + src/lib/db/community.ts:7-18 + src/app/zimbamilgrau/post-card.tsx:33-43` |
| medio | Site publico (leitor) | initials() duplicado 3x; a cópia do PostCard sem guarda contra string vazia | `src/app/zimbamilgrau/post-card.tsx:29-31 (+ site-header.tsx:34, zimbamilgrau/page.tsx:35)` |
| medio | Site publico (leitor) | Curadoria da home (cap/auto-fill/fillSection) acoplada a I/O e sem teste — já causou bug de home travada | `src/lib/db/articles.ts:130-207` |
| medio | Painel admin (cockpit) | media-studio.ts é god-file de 1157 linhas | `src/lib/actions/media-studio.ts` |
| medio | Motor de IA (radar Python) | article + audit_log sem transação; increment de error_count via select+update (race) | `radar/app/db/repositories.py:66-68 (update_source_run) + scheduler.py:221-237 (publish + insert_audit_log separados)` |
| medio | Motor de IA (radar Python) | Trigger manual de job roda síncrono no handler e acessa global privado cross-módulo | `radar/app/api/scheduler.py:65-75 (e :31)` |
| medio | Gateway IA + MCP + agente | Erro do radar/gateway mapeado por regex no texto da exceção — frágil e confunde transitório com estrutural | `src/app/api/ai/pauta/[id]/draft/route.ts:39-43 + src/lib/radar.ts:27-37 + zimbanet-mcp/client.py:12-17` |
| medio | Gateway IA + MCP + agente | Efeitos colaterais pós-publicação são fire-and-forget sem alerta (revalidatePath e finalizeArticle) | `src/app/api/ai/articles/[id]/publish/route.ts:114-123` |
| medio | Gateway IA + MCP + agente | editoria inválida cai pra 'cidade' silenciosamente + array de editorias redeclarado fora do canônico | `src/app/api/ai/articles/route.ts:10-12,66-67` |
| medio | Seguranca & integridade de dados (transversal) | Token de agente sem expiração + escopo 'publish' concedido fora dos presets | `src/lib/ai/tokens.ts:8-11 + src/lib/ai/agent-presets.ts:5-29 + src/lib/actions/agents.ts:68` |
| medio | UX (site leitor + painel dono) transversal | Pipeline IA tecnico exposto ao dono nao-tecnico no dashboard | `src/app/admin/page.tsx:199-245` |
| medio | UX (site leitor + painel dono) transversal | Fila nao mostra idade/recencia da fonte antes de publicar | `src/app/admin/fila/page.tsx:21,127` |
| baixo | Site publico (leitor) | Home sem Suspense por seção: hero rápido espera mural/bazar lento | `src/app/page.tsx:25-33` |
| baixo | Painel admin (cockpit) | Unicidade de capa garantida só em app logic, sem transação | `src/lib/actions/articles.ts:646-660` |
| baixo | UX (site leitor + painel dono) transversal | Paginas leitor force-dynamic sem skeleton/Suspense (painel ja tem) | `src/app/[editoria]/[slug]/page.tsx:22` |

## Componentes a refatorar (detalhe)

| Área | Componente | Esforço | Risco | Por quê |
|---|---|---|---|---|
| Site publico (leitor) | getHomepageData (curadoria da home) | P | medio | Extrair função pura + 3-4 testes (cap, auto-fill, hidratação, fillSection) é 2-4h, baixo risco, blinda contra regressão na regra que define o que o leitor vê na |
| Site publico (leitor) | getCidadesEmEditoria (chips de cidade) | P | baixo | Não dói hoje. RPC distinct é ~1h de SQL + migration, low-risk. Backlog, não urgente. |
| Site publico (leitor) | relativeTime / relTime (formatação de tempo) | P | baixo | ~30min, zero risco, corrige inconsistência de formato de data no mesmo site. Quick win. |
| Site publico (leitor) | initials (avatar) | P | baixo | Quick win, remove fragilidade de render e unifica 3 lógicas divergentes. ~30min. |
| Site publico (leitor) | #zimbamilgrau (page.tsx) + filtros de bairro | M | medio | É wiring, não reconstrução: trocar <button> por <Link ?bairro=> e implementar load-more por offset. 2-3h. Página renderiza o feed real corretamente. |
| Site publico (leitor) | #bazardazimba (page.tsx) + filtros | M | medio | fetchBazarItems já aceita type/category; é ligar searchParams ao fetch + mover busca pro ilike. 2-3h. Importante porque o resultado fica incorreto conforme o ba |
| Site publico (leitor) | getWeather (clima Open-Meteo) | P | baixo | ~1h, elimina risco de header lento por API externa pendurada. Quick win de resiliência. |
| Painel admin (cockpit) | Server Action publishArticle (publicar da edição) | M | alto | É um dos caminhos onde o conteúdo ruim vazou; a correção de recência foi pontual e não cobre os outros caminhos nem fonte/foto. |
| Painel admin (cockpit) | Server Action approveArticle (Fila → publicar) | M | critico | Maior volume e menos protegido; a trava anti-notícia-velha (commits 41b903e/62fb700) não chegou aqui. |
| Painel admin (cockpit) | Server Action publishBatch (Fila → publicar em lote) | M | alto | Lote multiplica o risco: um clique pode subir várias sem-fonte/velhas. Mesma causa-raiz. |
| Painel admin (cockpit) | Regras de publicação (causa-raiz transversal) | M | critico | Exatamente a dor do dono ('remendo em vários pontos e ainda escapava'). Extrair canPublish é a ação de maior alavancagem. Consolidação (P-M), não reconstrução. |
| Painel admin (cockpit) | Página Pauta (passo 1) + linked articles | P | baixo | Funciona hoje (acervo pequeno) mas degrada linearmente. RPC isolada é baixo risco. Não urgente. |
| Painel admin (cockpit) | media-studio.ts (Server Actions do Estúdio) | M | baixo | Funciona; é reorganização low-risk. O tamanho trava legibilidade/testabilidade. Não é reconstrução. |
| Motor de IA (radar Python) | publish_article + regras de recência (2º cérebro / código morto em prod) | M | alto | Confirmado que é código morto em prod: grep mostra que publish_article só é chamada por _autopublish_tick, que faz early-return quando autopublish_enabled=False |
| Motor de IA (radar Python) | Parsers de data regionais (parse_loose_dt / parse_br_dt) — bug de fuso | P | alto | Bug confirmado e REPRODUZIDO: parse_br_dt/parse_loose_dt fazem datetime(...,tzinfo=UTC) sobre horário que os portais exibem em BRT. Testei: artigo exibido 00:30 |
| Motor de IA (radar Python) | update_source_run — falha transitória tratada como estrutural | P | medio | Confirmado: run_source captura qualquer Exception (runner.py:109) e chama update_source_run(error=True), que incrementa error_count e grava last_status='erro' ( |
| Motor de IA (radar Python) | Coletor / Curador — ausência de trava de idade no item bruto | P | medio | Confirmado: submit_manual_url (runner.py:137-198) não aplica nenhum corte de idade — raspa, deduplica, insere e roda o Curador, que pontua relevância e não idad |
| Motor de IA (radar Python) | Scheduler (APScheduler) — orquestração de ticks | P | baixo | Confirmado o acoplamento: api/scheduler.py:68 e :31 leem scheduler_mod._scheduler (global privado com underscore) e :74 chama job.func() SÍNCRONO dentro do hand |
| Motor de IA (radar Python) | Camada de repositórios — anti-joins client-side e ausência de transação/atomicidade | M | baixo | Confirmado: o padrão limit*3 + anti-join em memória aparece em fetch_unscored_raw_items, fetch_approved_unenriched, fetch_enriched_no_article. update_source_run |
| Gateway IA + MCP + agente | recency.ts (trava anti-notícia-velha) | M | alto | É a causa-raiz da dor do dono: as regras de núcleo não vivem em UM lugar testável; o buraco do source_url é real. Extrair canPublish() puro + cobrir o caminho m |
| Gateway IA + MCP + agente | POST /api/ai/articles/{id}/publish | M | alto | Ponto mais sensível (sai no ar) e concentra lógica que deveria ser compartilhada. Funciona, mas o buraco source_url + regra não-testável = risco real. Refatorar |
| Gateway IA + MCP + agente | POST /api/ai/pauta/{id}/draft (pauta → rascunho) | P | medio | Funciona e o best-effort de foto é a parte boa (faz a trava de foto passar). Mas a duplicação e o erro-via-regex contribuem pras duas dores. Consertar (módulo c |
| Gateway IA + MCP + agente | POST /api/ai/articles (criar rascunho) | P | medio | Criação sólida (validação de tamanho, slug único, status forçado, audit). Gaps são P: importar EDITORIA_SLUGS de types.ts e devolver warning. Vale alinhar com a |
| Gateway IA + MCP + agente | radar.ts (seam TS → Python) | P | medio | Costura fina e tipada (bom). Mas a ausência de erro estruturado força o regex frágil no draft e contribui pro Hermes confundir timeout com infra caída. Classes  |
| Gateway IA + MCP + agente | ZimbanetClient (HTTP fino Python) | P | medio | É onde o sintoma 'Hermes lê timeout como infra caída' nasce do lado Python. Exceções tipadas (ZimbanetBadRequest vs ZimbanetTransient) + backoff em GET é P e at |
| Seguranca & integridade de dados (transversal) | permissions.ts + agent-presets.ts (RBAC) | P | medio | O escopo mais perigoso (publicar autônomo) não é visível/gerenciável no painel, mascarando quem pode publicar. Preset explícito + exibir escopos é P. |
| Seguranca & integridade de dados (transversal) | downloadAndStoreImage / storage-images (SSRF no download de imagem) | P | alto | Defesa SSRF existe e é boa, mas furada no ponto clássico. URL vem do agente/fonte externa (draft route:70 chama com raw_item.image_url scraped) e roda com servi |
| Seguranca & integridade de dados (transversal) | generateImage (re-hospedagem de saída de IA) — SSRF secundário | P | medio | Inconsistência de defesa: proteção SSRF não aplicada uniformemente. Rotear todos os fetches externos pelo mesmo assertSafeUrl é trivial e fecha por construção. |
| Seguranca & integridade de dados (transversal) | Travas de publicação (fonte + foto + recência) — espalhadas e burláveis | M | alto | Causa-raiz de 'notícia velha vazou': recência tem buraco estrutural (source_url não coberto, confirmado em recency.ts:58-66 que só lê via scoredId) e a regra es |
| Seguranca & integridade de dados (transversal) | Kill-switch de autopublish (app_settings) — FAIL-OPEN | P | critico | Inverter a lógica (default bloqueia, só 'true' libera) + migration de seed é ~1h e elimina o pior cenário: numa restauração o agente sobe a publicar sozinho sem |
| Seguranca & integridade de dados (transversal) | publish_article do radar (Python) — segundo cérebro divergente | M | alto | Confirmado que publish_article não tem checagem de foto/fonte (linhas 428-479). Mas o escopo conservador é DELETAR UMA FUNÇÃO + seu registro no scheduler — isso |
| Seguranca & integridade de dados (transversal) | Radar FastAPI (main.py/api) — sem autenticação, bind 0.0.0.0 | P | alto | Auth interna por shared secret é P e fecha a porta lateral que ignora todo o RBAC do gateway TS. Segurança hoje depende inteiramente da topologia de rede — frág |
| Seguranca & integridade de dados (transversal) | RLS + audit_log (integridade de dados) | M | alto | Postura de RLS é boa, mas o RBAC inteiro depende de função não versionada — restore quebra silenciosamente o controle de acesso do painel. Versionar is_admin/is |
| UX (site leitor + painel dono) transversal | Pagina de artigo (leitura) | P | medio | Leitura excelente; so o fallback de body vazio vaza jargao interno pro leitor. Troca de 1 string + idealmente bloquear publish sem body. |
| UX (site leitor + painel dono) transversal | #zimbamilgrau (mural comunitario) | M | medio | Feed real funciona, mas 3 affordances quebradas/fake num espaco que e 'a voz do povo' corroem confianca. Wire bairro (P), load-more real ou remover (P), trendin |
| UX (site leitor + painel dono) transversal | Painel — Dashboard inicial | P | medio | Topo (stats+atividade+motor via Suspense) e otimo; os 5 botoes de pipeline manual sao linguagem de engenheiro e confundem o dono nao-tecnico. Recolher em <detai |
| UX (site leitor + painel dono) transversal | Painel — Fila (passo 2, publicar) | P | medio | UX de foto/revisao e exemplar, mas a fila nao mostra idade/recencia da fonte — exatamente o buraco que deixou 'noticia velha vazar'. Badge de idade fecha o gap, |
| UX (site leitor + painel dono) transversal | Estados de loading (transversal, leitor) | M | baixo | Artigo e zimbamilgrau usam force-dynamic SEM Suspense/skeleton — bloqueiam o render ate Supabase responder, enquanto o painel ja domina o padrao Suspense. Aplic |