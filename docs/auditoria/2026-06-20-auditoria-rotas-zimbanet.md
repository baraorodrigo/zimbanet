# Auditoria Funcional — Rotas do ZIMBANET

> Auditoria rota-por-rota (deveria × faz × status), revisada adversarialmente. Data: 2026-06-20. 225 pontos de entrada (páginas, API, Server Actions, MCP, radar).

**Resumo:** 225 rotas — **115 ok · 45 parcial · 2 quebrado · 17 inseguro · 41 duplicado · 5 morto** (10 achados derrubados pelo cético).


## Panorama

O sistema está, no geral, FUNCIONANDO no essencial: o portal público (home, materias, mural, bazar, busca, tags, newsletter, login) abre e serve conteudo real do Supabase, e o pipeline do radar (coleta -> curador -> investigador -> redator) roda e gera rascunhos. De ~70 rotas/entradas auditadas, a grande maioria do MIOLO funciona; o problema NAO e "site no chao", e sim BORDAS quebradas e REGRA ESPALHADA. Dois machucados centrais explicam o "as vezes nao ta rolando": (1) a regra "pode publicar?" existe em 5 lugares com travas diferentes — pela Fila/edicao um editor sobe noticia velha/sem foto que o agente bloquearia; (2) o agente (Hermes) tem ~10 ferramentas que dao "sem permissao" (403) porque os perfis dele nao concedem os acessos que as rotas exigem — entao publicar/arquivar/definir capa pelo agente simplesmente nao funciona com os perfis padrao. Alem disso ha MUITA duplicacao consciente ("coisa em 2 lugares"): moderar mural/bazar, definir foto de capa, despublicar e rodar o radar vivem em painel E no agente, com pequenas divergencias. Itens "carregar mais"/filtro por bairro do mural sao enfeite (nao tem clique), e 2 telas mandam rodar um comando inexistente ("npm run curador"). Nada de dinheiro envolvido, entao os "inseguros" sao risco moderado, nao critico — exceto o radar Python que nao tem nenhuma trava de acesso na porta dele.


## Prioridade (resolver primeiro)

1. 1. UNIFICAR 'pode publicar?' numa unica canPublish()+publishArticleCore() e ligar Fila/lote/edicao/agente nela. Mata o 'noticia velha sobe pela Fila' (approveArticle/updateArticle sem trava) — maior impacto, esforco medio.
2. 2. CORRIGIR as permissoes do agente (agent-presets.ts + seed-agent.ts): conceder write:publish, write:homepage, write:community, write:bazar e os read: faltantes aos perfis certos. Sem isso ~10 tools do Hermes dao 403 — raiz do 'as vezes nao ta rolando' do agente. Esforco baixo, impacto alto.
3. 3. PROTEGER a porta do radar (FastAPI 8100): confirmar que NAO esta exposta em producao e/ou por uma API key no inbound. Hoje qualquer um na rede roda IA paga e liga/desliga o scheduler. Esforco baixo, risco alto se exposto.
4. 4. CONSOLIDAR a foto de capa (hero) num setArticleHero() unico com guard de status — funde 6 caminhos e fecha o buraco de sobrescrever capa de materia publicada. Esforco medio.
5. 5. ARRUMAR o mural /zimbamilgrau: ligar 'carregar mais' (paginacao) e o filtro por bairro (a funcao por tras ja aceita bairro), e remover o codigo morto. Esforco baixo, e o que o leitor ve.
6. 6. TROCAR as copys quebradas: 'npm run curador' (em /admin/pauta e /admin/fontes) e o WhatsApp placeholder '(48) 9 9999-9999' em /pauta. Esforco trivial, defeitos visiveis.
7. 7. FUNDIR moderacao de mural e bazar (painel + agente) numa funcao so e garantir revalidacao da pagina publica nos dois — hoje aprovacao do agente nao aparece ate o ISR. Esforco baixo.
8. 8. DECIDIR e ALINHAR a doutrina 'agente publica ou nao': hoje metade do gateway forca draft e a outra publica, e a memoria do projeto diz 'nunca publica'. Tambem corrigir o fuso de daily/analytics (UTC vs Sao Paulo) e os bugs de revalidate de comentario. Esforco baixo, tira ambiguidade.

## Quebrados

- **GLOBAL: 'npm run curador'** — As telas mandam o operador rodar 'npm run curador' no terminal, mas esse script NAO EXISTE no package.json (so ha dev/build/start/lint/import-bombei-sources/sync-bombei). Instrucao morta. A coleta real e pelos botoes do Dashboard/Autonomo. Conserto: trocar a copy. _( src/app/admin/pauta (empty state, linha ~620) e src/app/admin/fontes (linha ~87) )_
- **Permissoes do agente (Hermes)** — Os perfis do agente so concedem ler [articles,drafts,analytics] e escrever [article_content,slug,radar]. Mas ~10 ferramentas exigem acessos que NENHUM perfil da: publicar/despublicar/arquivar (write:publish), capa/destaque/urgente (write:homepage), moderar mural (write:community), moderar bazar (write:bazar), e ler pauta/pendencias/mural/bazar. Resultado: 403 'sem permissao' com qualquer agente criado pelos presets — so funciona se a linha do agente no banco foi editada a mao. Raiz tecnica do 'as vezes nao ta rolando' do lado do agente. _( src/lib/ai/agent-presets.ts + scripts/seed-agent.ts vs os resources exigidos nas rotas /api/ai/* )_
- **/zimbamilgrau — botao 'Carregar mais posts'** — Botao SEM handler (onClick): nao faz nada, fluxo morto. O feed fica travado em 36 posts sem paginacao. _( src/app/zimbamilgrau/page.tsx:175-177 )_
- **/zimbamilgrau — filtro por bairro** — Os botoes de bairro nao tem onClick nem href, e o 'ativo' e fixo no primeiro (i===0). Puro enfeite, nao filtra — embora fetchMuralPosts ja aceite o parametro bairro (community.ts:91). _( src/app/zimbamilgrau/page.tsx:129-140 )_
- **scripts/zimbanet_autoconfig_hermes.py** — A lista de ferramentas do perfil Hermes (ALL_MCP_TOOLS / expected_tools) cita ferramentas que NAO EXISTEM (run_pipeline, generate_social, approve_community_post, create_commercial_lead, submit_meme_review...). As reais sao outras (run_radar, moderate_mural, daily_report...). Nao quebra runtime (bloco enabled:false), mas confunde operador/agente. Alinhar com as 25 tools reais. _( scripts/zimbanet_autoconfig_hermes.py:16 (ALL_MCP_TOOLS) e expected_tools por papel )_

## Inseguros

- **approveArticle — Fila (src/lib/actions/articles.ts:290)** — O PIOR caso e o mais usado. Publica com UPDATE status=published direto por .eq('id') SEM nenhuma trava: nao checa foto, corpo, fonte nem recencia, e nem filtra o status atual (.in) — entao re-publica e reescreve a data ate de materia ja publicada. E exatamente a porta da 'noticia velha' que voce reclamou subir pela Fila. O 'so com foto' que voce ve na tela e enfeite de front; o servidor nao reconfere.
- **publishBatch — lote na Fila (articles.ts:341)** — Mesma falta de travas (foto/fonte/recencia). Tem so o filtro de status (melhor que o approve), mas sobe materia velha/sem foto em lote.
- **updateArticle — edicao (articles.ts:209)** — Quando o editor troca o status pra 'published' no form de edicao, publica SEM nenhuma trava (sem recencia, sem foto, sem fonte). 4o caminho que escapa das regras.
- **radar Python — app FastAPI (radar/app/main.py)** — A porta do radar (host:8100) NAO tem NENHUMA trava de acesso: sem auth, sem API key, sem CORS/host check. Quem alcancar a porta roda Curador/IA (gasta credito), liga/desliga o scheduler, finaliza materias. A unica protecao e o bind ser loopback — confirmar que em producao a 8100 NAO esta exposta. Falha estrutural #1 do radar.
- **applyAsArticleHero / setArticleHeroFromUrl / uploadArticleHeroFromForm (media-studio.ts)** — Escrevem a foto de capa via admin client (que ignora RLS) SEM checar o status da materia — podem sobrescrever a foto de uma materia JA PUBLICADA. So a rota do agente (/api/ai/articles/[id]/hero) trava por status. Auth (staff) ok; falta o guard de status.
- **uploadImage / uploadVideo (uploads.ts)** — Upload anonimo (sem login) por design pro fluxo guest. uploadVideo aceita 50MB e o comentario diz 'admin' mas NAO exige requireStaff (so e usado em tela admin). Sem rate-limit/captcha: endpoint abusavel pra encher o storage. Adicionar requireStaff no video e throttle no guest. Limite divergente: 8MB aqui vs 10MB nas actions de hero.
- **createMuralPost / createMuralComment (community.ts)** — Posts e comentarios do mural entram 'approved' por padrao — qualquer um publica direto, sem pre-moderacao. Sem rate-limit/captcha, guest com email aleatorio gera spam. Aceitavel pra mural comunitario, mas e abertura consciente que contraria a regra 'nada publica sem revisao' (essa regra vale pra noticias).
- **subscribeNewsletter (newsletter.ts) / settings.ts (chaves de API)** — Newsletter: publica sem captcha/throttle e vaza se o email ja existe (resposta diferente) — permite enumeracao. Settings: as chaves de API sao gravadas em TEXTO PURO em app_settings (mascaradas so na tela), mitigado por RLS sem policies (so service_role le). Baixo risco num portal sem dinheiro; registrado.

## Duplicações (mesma lógica em 2+ lugares)

- **'Pode publicar?' (a trava que decide se uma materia vai ao ar)**
  - vive em: approveArticle (articles.ts:290) — ZERO trava; publishBatch (articles.ts:341) — so filtra status; publishArticle (articles.ts:485) — checa tamanho+recencia, sem foto; updateArticle goingLive (articles.ts:209) — ZERO trava; POST /api/ai/articles/[id]/publish — trava COMPLETA (kill-switch+fonte+foto+recencia); radar publish_article (repositories.py:428) — recencia + fallback 7 dias, dormente
  - fonte única deveria ser: _Criar UMA funcao canPublish(article) + publishArticleCore(id) com as travas da rota /api/ai/.../publish (a mais completa) e fazer TODOS os caminhos (Fila, lote, edicao, agente, radar) chamarem ela. Conserto de MAIOR impacto; ataca direto o 'noticia velha sobe pela Fila'._
- **Definir/atualizar a FOTO de capa (hero): baixar->hospedar->gravar**
  - vive em: media-studio.ts: refreshArticleHeroFromSource (667), setArticleHeroFromUrl (800), uploadArticleHeroFromForm (853), applyAsArticleHero (573); generatePack heroJob (media-studio.ts ~521); POST /api/ai/articles/[id]/hero; best-effort inline em /api/ai/pauta/[id]/draft (70-74)
  - fonte única deveria ser: _UM setArticleHero(id, source, {requireEditableStatus}) chamado por todos. Hoje so a rota do agente trava por status; as 5+ do admin nao. Centralizar resolve o overlap e o buraco de seguranca de status._
- **Moderar post do mural (#zimbamilgrau): approve->published / reject->removed**
  - vive em: moderateMuralPost (moderation.ts:27) — painel; POST /api/ai/community/[id]/moderate — agente
  - fonte única deveria ser: _UMA moderateMural(id, decision) compartilhada. UPDATE identico nos 2; a rota do agente NAO revalida a pagina publica (post aprovado nao aparece ate o ISR)._
- **Moderar item do bazar (#bazardazimba): approve->active / reject->removed**
  - vive em: moderateBazarItem (moderation.ts:107) — painel; POST /api/ai/bazar/[id]/moderate — agente
  - fonte única deveria ser: _UMA moderateBazar(id, decision) compartilhada. Mesmo problema: rota do agente nao revalida a pagina publica._
- **Curadoria da home: capa unica + destaque (limpar capa anterior antes de marcar)**
  - vive em: setArticleAsCover / toggleArticleHighlight (articles.ts:625/675) — painel; POST /api/ai/articles/[id]/home — agente
  - fonte única deveria ser: _UMA logica 'home flags'. A regra 'capa unica, limpa a anterior' esta copiada nos 2; a unicidade e garantida no codigo (nao no banco), entao admin+agente concorrentes podem deixar 2 capas._
- **Despublicar materia (volta a rascunho)**
  - vive em: unpublishArticle (articles.ts:560) — painel, despublica de qualquer status; POST /api/ai/articles/[id]/unpublish — agente, so se published
  - fonte única deveria ser: _UM unpublish(id) compartilhado; hoje as 2 versoes ate divergem no comportamento._
- **Redigir pauta -> rascunho (Investigador+Redator)**
  - vive em: redigirScored / redigirBatch (articles.ts) via kickoffDraft (solta-e-esquece); POST /api/ai/pauta/[id]/draft (sincrono, +foto +recencia)
  - fonte única deveria ser: _Ambos ja chamam draftFromScored (lib/radar.ts) — duplicacao leve (wrappers). Manter draftFromScored como fonte e remover o caminho morto draftArticleWithAI._
- **Rodar os agentes do radar (curador/investigador/redator/pipeline)**
  - vive em: pipeline.ts (triggerCurador/... admin); /api/ai/radar/[agent] (agente); Python: /agents/*/run + ticks do scheduler.py + loops inline de /pipeline/run-all
  - fonte única deveria ser: _No TS ja convergem em lib/radar.ts (duplicacao leve). No Python, cada agente esta TRIPLICADO (endpoint + tick + loop inline em /pipeline/run-all) — refatorar pra reusar as funcoes de agents.py._
- **Checagem de recencia ('a fonte e de hoje?')**
  - vive em: src/lib/ai/recency.ts (TS, fonte real); filtro inline refeito a mao em /api/ai/pauta/route.ts (90-98); radar/app/db/repositories.py:422 (Python, espelho + fallback 7 dias so aqui)
  - fonte única deveria ser: _recency.ts no TS; a /pauta deveria usar o helper em vez de refazer a janela na mao. O Python espelha (aceitavel), mas o fallback de 7 dias so existe la — alinhar._
- **Painel de distribuicao social (aprovar/descartar/template/regerar card)**
  - vive em: /admin/social (fila cross-materia); /admin/materias/[id]/social-panel.tsx (inline); /admin/estudio/[id] (canvas)
  - fonte única deveria ser: _3 telas sobre social_posts usando as MESMAS actions (social.ts + media-studio.ts). Justificavel por escopo, mas e 'coisa em 3 lugares' — manter as actions como fonte unica e as telas como vistas finas._
- **Validacao de upload de imagem (File -> validar MIME/tamanho -> storeImageBuffer)**
  - vive em: uploadArticleHeroFromForm (media-studio.ts:853); uploadMediaFromForm (media-studio.ts:1056) — bloco copiado verbatim; uploads.ts/uploadImage (generico)
  - fonte única deveria ser: _Extrair validateImageFile() + storeImageBuffer parametrizado. Hoje e copia-cola; ate o limite diverge (10MB nas actions vs 8MB no uploads.ts)._

## Parciais (funciona pela metade)

- **/zimbamilgrau (mural)** — Nucleo (feed real, composer, likes, comentarios) funciona. Falta filtro por bairro e 'carregar mais' (ver quebrados), e ha codigo morto no branch [...posts,...posts] (page.tsx:56) que nunca executa porque o fallback retorna sempre 'supabase'.
- **/bazardazimba/[id]** — Busca real, mas faz FALLBACK pra anuncio FAKE (mock bazarItems) quando o banco nao acha — entao /bazardazimba/b1 mostra anuncio fantasma e o 404 nunca dispara pros ids de exemplo. Lista e detalhe divergem (lista nao usa mock).
- **/pauta (publica, contato do leitor)** — Pagina diz 'em breve teremos formulario' mas o envio nao existe (so mailto/whatsapp). WhatsApp e PLACEHOLDER '(48) 9 9999-9999' (page.tsx:35) — defeito real, trocar pelo numero verdadeiro.
- **trending/'Hashtags em alta' no /zimbamilgrau** — Renderiza array fixo (mock) como texto sem link — nao reflete dados reais nem leva a busca/tag. Cosmetico.
- **/admin/pauta (Curador)** — Triagem e Redigir funcionam. A busca 'q' filtra EM MEMORIA so sobre os 80 itens ja carregados — termo que so aparece no item 81+ nao e achado.
- **/admin/auditoria** — Mostra a timeline crua, mas (1) so traduz 8 tipos de evento — o resto aparece com nome tecnico cru (agent_publish, generate_pack, moderate_*, set_hero_from_url...); (2) IGNORA o filtro ?entity_type que o link do Curador manda (a page nem le searchParams).
- **/admin/fontes** — Funciona (ativar/pausar/apagar, hit-rate de foto). So a copy 'rode npm run curador' esta errada (ver quebrados).
- **/admin/social** — Prepara o pacote social mas NAO posta sozinho nas redes (publicacao e manual, colando link). E honesto sobre isso. Overlap com painel inline e estudio.
- **GET /api/ai/pauta (lista de pautas do agente)** — Filtro de recencia e 'ja tem materia' e feito em memoria sobre um over-fetch limitado (ate 200); se houver muita pauta antiga no topo, a lista pode vir curta. Sem paginacao real. Aceitavel no volume atual.
- **GET /api/ai/analytics/daily e daily_report (MCP)** — Conta 'hoje' por UTC (slice da data ISO) enquanto TODA a regra editorial usa fuso de Sao Paulo — os numeros de 'publicadas hoje' e 'coletadas hoje' erram na janela 21h-00h (BRT). Inconsistencia de fuso.
- **publishArticle (tela de edicao, articles.ts:485)** — Caminho humano mais completo (checa tamanho + recencia) MAS nao exige foto (hero), e a trava de recencia escapa quando a materia foi criada a mao (sem scored_item_id). Diverge da rota do agente que exige foto.
- **createBazarItem (community.ts:164)** — BUG de rotulo: o resultado devolve status:'published' pro usuario mesmo gravando 'pending_confirmation'/'active' no banco — a mensagem na tela nao bate com o estado real.
- **createArticleComment (community.ts:371)** — BUG de revalidacao: revalida '/{slug}' sem a editoria, mas a pagina real e '/{editoria}/{slug}' — o comentario novo so aparece no proximo ISR, nao na hora.
- **moderateArticleComment / moderateMuralComment (moderation.ts)** — moderateArticleComment so revalida o painel, nao a pagina publica da materia (comentario rejeitado some so no proximo ISR). moderateMuralComment nao grava audit_log nem loga erro (unica das 4 moderacoes sem auditoria).
- **POST /pipeline/finalize/{id} (radar)** — Chamado 'solta e esquece' depois da publicacao; se falhar, a materia fica publicada SEM pacote social/visual e sem retry — erro so vai pro console. O social pode silenciosamente nao sair.
- **redigirScored/redigirBatch/kickoffDraft (articles.ts)** — 'Solta e esquece': engole o erro. O usuario ve 'ok' e so percebe a falha pela ausencia do rascunho. (draftArticleWithAI no mesmo arquivo e codigo morto — ver mortos.)
- **regenerateImageFromSlots (visual-slots.ts:102)** — STUB: o nome promete enfileirar regeracao de imagem, mas so grava um marcador no audit_log e ninguem consome essa fila. A geracao real vem por outro caminho (VariationsGallery).
- **Ferramentas MCP de publicacao/home/moderacao do agente** — A LOGICA das rotas esta correta e bem travada; o que falta e ACESSO (permissoes) — ver quebrados. Sem isso, publicar/arquivar/definir capa/moderar pelo agente da 403.
- **Doutrina 'agente publica' contraditoria** — Metade do gateway diz 'agente NUNCA publica' (api/ai/articles/route.ts forca draft) e a outra metade habilita publicacao (api/ai/articles/[id]/publish e a tool MCP 'publicar'). A memoria do projeto ainda diz 'agente nunca publica'. Precisa decidir a doutrina e alinhar.

## Mortos (órfãos, candidatos a deletar)

- switchActiveChannel (src/lib/actions/studio.ts:131) — ZERO callers no repo; so escreveria audit_log de um evento que ninguem dispara. Candidato a deletar.
- draftArticleWithAI (src/lib/actions/articles.ts:447) — comentario diz 'Compat: ainda usada' mas grep mostra ZERO importacoes. Shim morto; remover.
- POST /agents/revisor/run (radar/app/agents.py:56) — endpoint HTTP orfao: sem wrapper em radar.ts, sem tick, sem uso no MCP. O selo de revisao real vem por _run_draft_package. Nunca chamado.
- POST /agents/visual/run (radar/app/agents.py:157) — endpoint HTTP orfao: a funcao visualize_article e usada por finalize/draft-package/tick, mas o ENDPOINT nunca e disparado.
- _autopublish_tick (radar/app/scheduler.py:196) — DORMENTE, nao morto: job registrado e roda a cada 20min, mas faz early-return porque autopublish_enabled=False por padrao. CUIDADO: se ligarem a flag, publica com criterio diferente (fallback 7 dias). Nao deletar sem decidir; e um 5o publish latente.
- regenerateImageFromSlots (visual-slots.ts:102) — nao orfa (e chamada), mas e stub que so escreve audit e ninguem consome a 'fila'. Renomear ou remover.
- Branch [...posts,...posts,...posts] em /zimbamilgrau page.tsx:56 — codigo morto: nunca executa porque o fallback retorna sempre source:'supabase'.

## Inventário completo (por status)

| Status | Rota | Grupo | Nota |
|---|---|---|---|
| quebrado | GLOBAL: 'npm run curador' (citado em /admin/pauta:620 e /adm | Paginas admin (cockpit) | CONFIRMADO quebrado. package.json scripts = dev/build/start/lint/import-bombei-sources/syn |
| quebrado | PERMISSOES — src/lib/ai/agent-presets.ts + scripts/seed-agen | Ferramentas MCP (as 25 d | CONFIRMADO quebrado — RAIZ do 'as vezes nao ta rolando'. checkPermission (permissions.ts l |
| inseguro | /admin/fila | Paginas admin (cockpit) | CONFIRMADO inseguro. O gate 'so com foto' e SO no front (linha 67-68, 201-216). approveArt |
| inseguro | approveArticle (lib/actions/articles.ts:290) | Paginas admin (cockpit) | CONFIRMADO inseguro. Publica qualquer rascunho cru — nem o filtro .in(status,[draft,review |
| inseguro | publishBatch (lib/actions/articles.ts:341) | Paginas admin (cockpit) | CONFIRMADO inseguro. UI da Fila so deixa marcar 'com foto' (checkbox so aparece se hasHero |
| inseguro | GLOBAL: logica 'pode publicar?' espalhada | Paginas admin (cockpit) | CONFIRMADO — causa raiz de 'as vezes nao ta rolando': a mesma materia publica ou nao depen |
| inseguro | updateArticle (src/lib/actions/articles.ts:209) | Server Actions — editori | CONFIRMADO inseguro. O caminho goingLive publica SEM nenhuma trava: nao chama sourceIsFrom |
| inseguro | approveArticle (src/lib/actions/articles.ts:290) | Server Actions — editori | CONFIRMADO inseguro e o pior dos caminhos. Verifiquei o update: e .eq('id', id) SEM .in('s |
| inseguro | publishBatch (src/lib/actions/articles.ts:341) | Server Actions — editori | CONFIRMADO. 3a copia da logica de publicar. Tem o filtro .in('status') que approveArticle  |
| inseguro | createMuralPost (src/lib/actions/community.ts:75) | Server Actions — editori | CONFIRMADO. Posts entram moderation_status='approved' por padrao — sem pre-moderacao, qual |
| inseguro | uploadImage (uploads.ts:30) | Server Actions — midia/e | CONFIRMADO. Anonimo POR DESIGN — image-picker.tsx usado em fluxos guest (zimbamilgrau/comp |
| inseguro | uploadVideo (uploads.ts:83) | Server Actions — midia/e | CONFIRMADO. Comentario diz 'admin baixa e sobe' e o UNICO caller (video-picker.tsx) so apa |
| inseguro | src/lib/actions/settings.ts › listSlotsConfig / saveSlotConf | Server Actions — operaca | CONFIRMADO 'inseguro', mas right-sized. As chaves de API são gravadas em app_settings em T |
| inseguro | src/lib/actions/newsletter.ts › subscribeNewsletter | Server Actions — operaca | CONFIRMADO 'inseguro', right-sized. Endpoint PÚBLICO (sem auth, por design) usando admin c |
| inseguro | (global) app FastAPI — radar/app/main.py | Endpoints do radar (Pyth | CONFIRMADO inseguro. A unica trava (withAgent/ensureStaff) vive no TS (src/lib/actions/* e |
| inseguro | POST /scheduler/start | Endpoints do radar (Pyth | CONFIRMADO inseguro no endpoint (sem auth; trava withAgent/ensureStaff so no TS via trigge |
| inseguro | POST /scheduler/stop | Endpoints do radar (Pyth | CONFIRMADO mesmo caso do /start: sem auth no endpoint; qualquer um na rede do radar deslig |
| inseguro | moderate_mural (server.py) -> POST /api/ai/community/{id}/mo | Ferramentas MCP (as 25 d | MANTIDO inseguro (dois motivos confirmados). (1) DUPLICACAO REAL: moderateMuralPost em src |
| inseguro | approveArticle (Fila) | DUPLICACAO transversal ( | CONFIRMADO. O caminho mais usado pelo editor (Fila) e o que menos valida. Materia velha/se |
| duplicado | /admin/materias/[id]/social-panel.tsx (SocialDistribution) | Paginas admin (cockpit) | CONFIRMADO duplicado. 3a tela sobre social_posts (inline). Mesmas actions de social.ts e m |
| duplicado | lib/actions/media-studio.ts (hero: refreshArticleHeroFromSou | Paginas admin (cockpit) | CONFIRMADO duplicado, NAO morto: grep confirma todas as funcoes wired em materias/[id]/(he |
| duplicado | POST /api/ai/articles/[id]/hero | Rotas de API (gateway /a | CONFIRMADO funciona bem e e bem escopado (so rascunho/revisao). A 'duplicacao' e fraca no  |
| duplicado | POST /api/ai/community/[id]/moderate | Rotas de API (gateway /a | DUPLICACAO CONFIRMADA: escrita IDENTICA a moderateMuralPost (mesmo mapeamento approved->pu |
| duplicado | POST /api/ai/bazar/[id]/moderate | Rotas de API (gateway /a | DUPLICACAO CONFIRMADA: mesma transicao (active/removed) que moderateBazarItem. A Server Ac |
| duplicado | createArticle (src/lib/actions/articles.ts:137) | Server Actions — editori | CONFIRMADO duplicado. Insert em articles vive em 2 lugares sem helper. Divergencias reais: |
| duplicado | unpublishArticle (src/lib/actions/articles.ts:560) | Server Actions — editori | CONFIRMADO duplicado. Mesma regra em 2 lugares. Diferenca real: a rota do agente filtra .e |
| duplicado | moderateMuralPost (src/lib/actions/moderation.ts:27) | Server Actions — editori | CONFIRMADO duplicado. Verifiquei a rota do agente: o MESMO mapeamento approve->published / |
| duplicado | moderateBazarItem (src/lib/actions/moderation.ts:107) | Server Actions — editori | CONFIRMADO duplicado. A rota do agente repete o MESMO mapeamento approve->active / reject- |
| duplicado | applyAsArticleHero (media-studio.ts:573) | Server Actions — midia/e | CONFIRMADO. 5+ caminhos escrevem articles.hero_image_url e SO o endpoint do agente (route. |
| duplicado | setArticleHeroFromUrl (media-studio.ts:800) | Server Actions — midia/e | CONFIRMADO. Mesma logica de re-hospedar+gravar hero das demais, mesma falta de trava de st |
| duplicado | refreshArticleHeroFromSource (media-studio.ts:667) | Server Actions — midia/e | CONFIRMADO. Funciona com bom fallback. Mesma falta de trava de status. scrapeOgImage (linh |
| duplicado | uploadArticleHeroFromForm (media-studio.ts:853) | Server Actions — midia/e | CONFIRMADO. Bloco de validacao File (instanceof File / startsWith('image/') / 10MB) identi |
| duplicado | uploadMediaFromForm (media-studio.ts:1056) | Server Actions — midia/e | CONFIRMADO. Bloco de validacao File copiado verbatim de uploadArticleHeroFromForm (so muda |
| duplicado | fetchSourceImage (media-studio.ts:994) | Server Actions — midia/e | CONFIRMADO. Logica de re-hospedar hero->media_url identica a applyHeroToAllSocialPosts (ve |
| duplicado | applyHeroToAllSocialPosts (media-studio.ts:920) | Server Actions — midia/e | CONFIRMADO. Versao batch de fetchSourceImage. Loop sequencial (nao Promise.all). UNICA act |
| duplicado | applySocialKitTemplateToPost (media-studio.ts:342) | Server Actions — midia/e | CONFIRMADO. Montagem de params e chamada do /api/social/render copiada quase verbatim de a |
| duplicado | /api/ai/articles/[id]/hero/route.ts | Server Actions — midia/e | CONFIRMADO. Existe no caminho src/app/api/ai/articles/[id]/hero/route.ts (auditoria inicia |
| duplicado | POST /agents/curador/run | Endpoints do radar (Pyth | Logica correta porem triplicada. Chamado por runCurador (radar.ts:94) <- triggerCurador /  |
| duplicado | POST /agents/investigador/run | Endpoints do radar (Pyth | ok funcionalmente. Chamado por runInvestigador (radar.ts:99). Triplicado. |
| duplicado | POST /agents/redator/run | Endpoints do radar (Pyth | ok funcionalmente. Chamado por runRedator (radar.ts:104). Diferenca minima: aqui busca sco |
| duplicado | POST /agents/analista/run | Endpoints do radar (Pyth | ok. Chamado por runAnalista (radar.ts:109) <- triggerAnalista. |
| duplicado | POST /agents/distribuidor/run | Endpoints do radar (Pyth | CONFIRMADO caminho legitimo: chamado por redistributeArticle (radar.ts:82) <- personas.ts: |
| duplicado | POST /collect/run | Endpoints do radar (Pyth | ok funcionalmente. Chamado por runCollectAll (radar.ts:127) <- triggerCollectAll. |
| duplicado | POST /pipeline/run-all | Endpoints do radar (Pyth | CONFIRMADO epicentro da duplicacao: reimplementa INLINE os loops de curador/investigador/r |
| duplicado | moderate_bazar (server.py) -> POST /api/ai/bazar/{id}/modera | Ferramentas MCP (as 25 d | REBAIXADO de 'inseguro' para 'duplicado'. Diferente do mural, NAO ha regra de conteudo gra |
| duplicado | LOGICA: "pode publicar?" — fonte unica inexistente | DUPLICACAO transversal ( | CONFIRMADO problema #1. As travas nao batem entre caminhos. E o eixo central da refatoraca |
| duplicado | publishBatch (lote na Fila) | DUPLICACAO transversal ( | CONFIRMADO. Mesmo arquivo carrega 3 implementacoes de publish (approve/batch/publish) com  |
| duplicado | publishArticle (tela de edicao) | DUPLICACAO transversal ( | CONFIRMADO. Tres niveis de rigor: approve(0) < publishArticle(recencia+tamanho) < rota age |
| duplicado | POST /api/ai/articles/[id]/publish | DUPLICACAO transversal ( | CONFIRMADO. Caminho mais correto mas e o 4o lugar. Falta push breaking aqui. auto_publishe |
| duplicado | LOGICA: checagem de recencia ("fonte e de hoje?") | DUPLICACAO transversal ( | CONFIRMADO. TS/Python sao copias paralelas (cross-linguagem, aceitavel) mas a regra '7 dia |
| duplicado | LOGICA: definir/atualizar hero (foto de capa) | DUPLICACAO transversal ( | CONFIRMADO problema #2. Pelo menos 4 copias do nucleo baixar->hospedar->update. |
| duplicado | refreshArticleHeroFromSource vs setArticleHeroFromUrl (media | DUPLICACAO transversal ( | CONFIRMADO. 4 maneiras da mesma foto de capa (refresh, setFromUrl, uploadFromForm, rota /h |
| duplicado | LOGICA: aplicar imagem da fonte como hero/em posts | DUPLICACAO transversal ( | CONFIRMADO. Convivem o cerebro visual do JS (media-studio, manual/admin) e o do agente Pyt |
| duplicado | LOGICA: moderar mural (#zimbamilgrau) | DUPLICACAO transversal ( | CONFIRMADO problema #2. Mesmo mapeamento de status nos 2. Mudar a regra exige tocar 2 arqu |
| duplicado | LOGICA: moderar bazar (#bazardazimba) | DUPLICACAO transversal ( | CONFIRMADO. Mural+bazar somam 4 copias do padrao approve/reject->UPDATE->audit. |
| duplicado | LOGICA: curadoria da home (capa/destaque) | DUPLICACAO transversal ( | CONFIRMADO. Divergencia de semantica: action e toggle (inverte estado); rota e set explici |
| duplicado | LOGICA: despublicar materia | DUPLICACAO transversal ( | CONFIRMADO. Divergencia: action despublica de qualquer status; rota so de published (e ret |
| duplicado | LOGICA: redigir pauta -> rascunho (Investigador+Redator) | DUPLICACAO transversal ( | CONFIRMADO duplicado, e draftArticleWithAI esta MORTO (agente subestimou — disse 'candidat |
| duplicado | LOGICA: rodar agentes do radar (curador/investigador/redator | DUPLICACAO transversal ( | CONFIRMADO, mas duplicacao LEVE: ambos chamam a mesma lib/radar.ts. Divergencia: pipeline. |
| duplicado | LOGICA: gerar variacao de imagem AI (hero) | DUPLICACAO transversal ( | CONFIRMADO mas right-sized: concentrado num arquivo so (menos espalhado). Debito real, nao |
| parcial | /zimbamilgrau | Paginas publicas (leitor | CONFIRMADO parcial. (1) Filtro por bairro: os <button> em page.tsx:129-140 nao tem onClick |
| parcial | /bazardazimba/[id] | Paginas publicas (leitor | CONFIRMADO parcial. loadItem faz fallback pra bazarItems mock (page.tsx:32) quando o banco |
| parcial | /pauta (publica) | Paginas publicas (leitor | CONFIRMADO parcial, mas baixo impacto. A propria pagina diz 'em breve teremos um formulari |
| parcial | trending (mock) em /zimbamilgrau | Paginas publicas (leitor | CONFIRMADO parcial, cosmetico. Renderizado como <span> sem link nem onClick — puro enfeite |
| parcial | /admin/pauta | Paginas admin (cockpit) | CONFIRMADO parcial. Busca 'q' e in-memory pos-limit(80) — termo so no item 81+ nao acha. E |
| parcial | publishArticle (lib/actions/articles.ts:485) | Paginas admin (cockpit) | CONFIRMADO parcial. Tem corpo+recencia mas NAO exige foto (diferente da Fila/UI e do agent |
| parcial | /admin/social | Paginas admin (cockpit) | CONFIRMADO parcial e honesto: nao posta sozinho nas redes, so prepara. Funciona. Overlap c |
| parcial | /admin/fontes | Paginas admin (cockpit) | CONFIRMADO parcial. Copy linha 87 diz 'Pra coletar agora rode npm run curador' — script IN |
| parcial | /admin/auditoria | Paginas admin (cockpit) | CONFIRMADO parcial e PIOR que o brief sugere: alem das acoes sem rotulo caindo no fallback |
| parcial | POST /api/ai/articles/[id]/publish | Rotas de API (gateway /a | CONFIRMADO. Unica porta de publicacao com trava completa. PROBLEMA 1 (duplicacao/divergenc |
| parcial | POST /api/ai/articles/[id]/home | Rotas de API (gateway /a | CONFIRMADO funciona. Duplica a estrategia capa-unica de setArticleAsCover (uniqueness gara |
| parcial | GET /api/ai/pauta | Rotas de API (gateway /a | CONFIRMADO. Filtro de recencia e 'ja tem materia' e EM MEMORIA (JS) sobre over-fetch. Se h |
| parcial | GET /api/ai/analytics/daily | Rotas de API (gateway /a | CONFIRMADO. 'today' = new Date().toISOString().slice(0,10) = UTC, enquanto TODA a regra ed |
| parcial | publishArticle (src/lib/actions/articles.ts:485) | Server Actions — editori | CONFIRMADO parcial. Caminho humano mais completo (unico com recencia + tamanho). MAS verif |
| parcial | setArticleAsCover (src/lib/actions/articles.ts:625) | Server Actions — editori | CONFIRMADO. A rota /home do agente repete a MESMA logica de 'limpa outras capas antes de m |
| parcial | redigirScored / redigirBatch / draftArticleWithAI / kickoffD | Server Actions — editori | CONFIRMADO parcial + dead code. Fire-and-forget engole erro: usuario ve 'ok' e so percebe  |
| parcial | createBazarItem (src/lib/actions/community.ts:164) | Server Actions — editori | CONFIRMADO parcial. Logado entra 'active' sem moderacao previa (mesma abertura do mural).  |
| parcial | createMuralComment (src/lib/actions/community.ts:327) | Server Actions — editori | CONFIRMADO. Comentario entra 'approved' sem pre-moderacao, como o mural. Aceitavel, mas re |
| parcial | createArticleComment (src/lib/actions/community.ts:371) | Server Actions — editori | CONFIRMADO bug de revalidate. A pagina de materia vive em src/app/[editoria]/[slug]/page.t |
| parcial | moderateMuralComment (src/lib/actions/moderation.ts:58) | Server Actions — editori | CONFIRMADO. Unica das 4 moderacoes que NAO grava audit_log e nao loga o erro (as outras gr |
| parcial | moderateArticleComment (src/lib/actions/moderation.ts:78) | Server Actions — editori | CONFIRMADO. Nao revalida a pagina publica da materia (so /admin/moderacao). Comentario rej |
| parcial | approveSocialPost (src/lib/actions/social.ts:35) | Server Actions — editori | CONFIRMADO. Por design nao ha integracao IG/FB: 'ready' e so flag; publicacao real depende |
| parcial | generatePack (media-studio.ts:437) | Server Actions — midia/e | CONFIRMADO PARCIAL. Linha 457: filtra social_posts por status!='failed' SEM excluir 'publi |
| parcial | regenerateImageFromSlots (visual-slots.ts:102) | Server Actions — midia/e | CONFIRMADO STUB. Nada consome a fila — o proprio comentario (linha 99) diz que a geracao e |
| parcial | src/lib/actions/auth.ts › (Facebook OAuth ausente) | Server Actions — operaca | CONFIRMADO 'parcial'. Grep em auth.ts e login/page.tsx: nenhum signInWithOAuth({provider:' |
| parcial | POST /pipeline/finalize/{article_id} | Endpoints do radar (Pyth | CONFIRMADO parcial: chamado fire-and-forget (.catch sem await) de /api/ai/articles/[id]/pu |
| parcial | POST /scheduler/run/{job_id} | Endpoints do radar (Pyth | CONFIRMADO fragil: (1) job.func() roda SINCRONO no request — ticks de Sonnet podem estoura |
| parcial | create_article (server.py) -> POST /api/ai/articles | Ferramentas MCP (as 25 d | CONFIRMADO parcial, mas a tese do 'beco sem saida silencioso' e PARCIALMENTE EXAGERADA: CR |
| parcial | publicar (server.py) -> POST /api/ai/articles/{id}/publish | Ferramentas MCP (as 25 d | REBAIXADO de 'inseguro' para 'parcial'. A rota NAO e insegura — ela e a UNICA com travas s |
| parcial | despublicar (server.py) -> POST /api/ai/articles/{id}/unpubl | Ferramentas MCP (as 25 d | REBAIXADO de 'inseguro' para 'parcial'. Logica intacta; nao ha falta de trava — e acesso:  |
| parcial | run_radar (server.py) -> POST /api/ai/radar/{agent}?limit= | Ferramentas MCP (as 25 d | CONFIRMADO parcial. Funciona SO com preset 'radar' (unico com write:radar). Editor/seo/dir |
| parcial | submit_url_to_radar (server.py) -> POST /api/ai/radar/submit | Ferramentas MCP (as 25 d | CONFIRMADO parcial. Mesma trava: so preset 'radar'. submitUrlToRadar existe e wiring ok. |
| parcial | definir_capa (server.py) -> POST /api/ai/articles/{id}/home  | Ferramentas MCP (as 25 d | REBAIXADO de 'inseguro' para 'parcial'. Logica correta; nao falta validacao. Defeito e ace |
| parcial | definir_destaque (server.py) -> POST /api/ai/articles/{id}/h | Ferramentas MCP (as 25 d | REBAIXADO de 'inseguro' para 'parcial'. As 3 tools (capa/destaque/urgente) batem na MESMA  |
| parcial | marcar_urgente (server.py) -> POST /api/ai/articles/{id}/hom | Ferramentas MCP (as 25 d | REBAIXADO de 'inseguro' para 'parcial'. Acesso bloqueado (sem write:homepage). is_breaking |
| parcial | arquivar (server.py) -> POST /api/ai/articles/{id}/archive | Ferramentas MCP (as 25 d | REBAIXADO de 'inseguro' para 'parcial'. Logica correta; defeito e acesso (write:publish au |
| parcial | pendencias (server.py) -> GET /api/ai/pendencias | Ferramentas MCP (as 25 d | CONFIRMADO parcial. read:pendencias so via director (read:all); editor/seo/radar -> 403. D |
| parcial | list_pauta (server.py) -> GET /api/ai/pauta?decision=&limit= | Ferramentas MCP (as 25 d | CONFIRMADO parcial. Filtro de recencia/ja_tem_materia EM MEMORIA com over-fetch limitado — |
| parcial | trabalhar_pauta (server.py) -> POST /api/ai/pauta/{id}/draft | Ferramentas MCP (as 25 d | CONFIRMADO parcial. Acesso so write:radar (preset radar). Trava de recencia usa sourceIsFr |
| parcial | daily_report (server.py) -> GET /api/ai/analytics/daily | Ferramentas MCP (as 25 d | CONFIRMADO parcial. Divergencia de fuso REAL: today=new Date().toISOString().slice(0,10) ( |
| parcial | list_mural (server.py) -> GET /api/ai/community?moderation_s | Ferramentas MCP (as 25 d | CONFIRMADO parcial. read:community so via director (read:all). Nenhum preset 'comunidade'  |
| parcial | list_bazar (server.py) -> GET /api/ai/bazar?status=&limit= | Ferramentas MCP (as 25 d | CONFIRMADO parcial. read:bazar so via director (read:all); demais presets -> 403. |
| parcial | publish_article (radar/repositories.py:428) | DUPLICACAO transversal ( | REBAIXADO de 'morto' para 'parcial': o agente disse 'scheduler off / orfa', mas o job esta |
| parcial | LOGICA: rodar Curador ao submeter URL | DUPLICACAO transversal ( | CONFIRMADO parcial. Duas formas de 'trazer materia de URL' com resultados divergentes: sub |
| parcial | create_article: comentario 'agente NUNCA publica' vs rota /p | DUPLICACAO transversal ( | CONFIRMADO. Nao e duplicacao de codigo, e duplicacao de REGRA contraditoria: metade do gat |
| morto | switchActiveChannel (studio.ts:131) | Server Actions — midia/e | CONFIRMADO ORFA. Grep no repo: unica ocorrencia e a definicao em studio.ts:131, ZERO calle |
| morto | POST /agents/revisor/run | Endpoints do radar (Pyth | CONFIRMADO orfao no nivel HTTP: grep 'revisor/run' em todo o repo so acha a propria defini |
| morto | POST /agents/visual/run | Endpoints do radar (Pyth | CONFIRMADO orfao no nivel HTTP: grep 'visual/run' so acha a definicao (agents.py:157); sem |
| morto | (scheduler) _autopublish_tick — radar/app/scheduler.py:196 | Endpoints do radar (Pyth | CONFIRMADO morto/desligado hoje (autopublish_enabled=False; job registrado em scheduler.py |
| morto | HERMES profile config — scripts/zimbanet_autoconfig_hermes.p | Ferramentas MCP (as 25 d | CONFIRMADO morto (drift de documentacao). NAO quebra runtime: o bloco usa enabled:false (l |
| ok | / (src/app/page.tsx) | Paginas publicas (leitor | OK. Estado vazio coberto (EmptyHero, blocos so renderizam se length>0). |
| ok | /[editoria] (lista de editoria) | Paginas publicas (leitor | OK. Paginacao e filtro sao reais (nao em memoria). Bom tratamento de noindex em pagina>1/c |
| ok | /[editoria]/[slug] (materia) | Paginas publicas (leitor | OK. Aviso 'modo demo' aparece quando body vazio — esperado, nao e bug. Cidades linkam pra  |
| ok | /buscar | Paginas publicas (leitor | OK. noindex aplicado. Busca real no banco. |
| ok | /tag/[slug] | Paginas publicas (leitor | OK. |
| ok | /bazardazimba | Paginas publicas (leitor | OK. Filtragem por searchParams e real (nao em memoria solta — roda no server a cada reques |
| ok | /anuncie | Paginas publicas (leitor | OK (conteudo estatico). |
| ok | /newsletter | Paginas publicas (leitor | OK na pagina. Funcionamento real depende do action/endpoint do NewsletterForm (auditar no  |
| ok | /push | Paginas publicas (leitor | OK estrutural. Se VAPID env nao estiver setada, exibe erro tratado ('VAPID public key nao  |
| ok | /minha-conta | Paginas publicas (leitor | OK. Auth gate correto (requireUser). Abas por searchParam server-side. |
| ok | /login | Paginas publicas (leitor | OK. next sanitizado (anti open-redirect). signInAsDev so renderiza fora de producao. |
| ok | /editorial, /sobre, /termos, /privacidade | Paginas publicas (leitor | OK. Emails dpo@/redacao@/comercial@ e datas 'atualizado em' sao placeholders de conteudo,  |
| ok | /social-template/card-1080, /banner-1200x630, /story-1080x19 | Paginas publicas (leitor | OK. Sao paginas de servico (consumidas por screenshot, nao navegacao humana) — por isso 'o |
| ok | Componentes de chrome: SiteHeader / SiteFooter / Sidebar | Paginas publicas (leitor | OK. Nenhum link quebrado/morto no chrome. Social aponta instagram/facebook.com/zimbanet (p |
| ok | src/app/admin/layout.tsx | Paginas admin (cockpit) | Guard correto e unico ponto. Boa arquitetura. |
| ok | /admin (page.tsx) | Paginas admin (cockpit) | Os 5 disparos de pipeline aqui repetem os de /admin/autonomo (mesmas actions runX do lib/r |
| ok | /admin/pauta/pauta-interactive.tsx (redigirScored/redigirBat | Paginas admin (cockpit) | draftArticleWithAI marcada 'Compat' faz a mesma coisa via form; candidata a remover. |
| ok | /admin/fila/fila-interactive.tsx | Paginas admin (cockpit) | Padrao de selecao duplicado entre Fila e Pauta — poderia ser componente unico, mas funcion |
| ok | /admin/curador | Paginas admin (cockpit) | NAO e duplicata da Pauta (pauta=lista triada; curador=config do scorer). Copy diz 'Haiku p |
| ok | /admin/materias | Paginas admin (cockpit) | Filtro por status/editoria e server-side (ok). Limite fixo 80 sem paginacao — acervo grand |
| ok | /admin/materias/[id] | Paginas admin (cockpit) | Pagina central e coesa. A duplicacao de social esta nos sub-paineis, nao na pagina. |
| ok | /admin/social/social-actions.tsx (CopyCaptionButton) | Paginas admin (cockpit) | navigator.clipboard.writeText com feedback |
| ok | /admin/estudio/[article_id] | Paginas admin (cockpit) | Mais completo dos 3. Orfa de sidebar mas alcancavel por links — nao e morta. |
| ok | /admin/capa | Paginas admin (cockpit) | Mesmas actions da edicao, mas tela dedicada de curadoria — uso valido, nao confunde. 'Solt |
| ok | /admin/moderacao | Paginas admin (cockpit) | Brief cita 'moderacao em action E em /api/ai'. Aqui (painel) usa lib/actions/moderation.ts |
| ok | lib/actions/moderation.ts (moderateMuralPost/Comment/Article | Paginas admin (cockpit) | moderateMuralComment nao insere audit_log (as outras 3 inserem) — inconsistencia menor de  |
| ok | /admin/fontes/nova e /admin/fontes/[id] | Paginas admin (cockpit) | Nao inspecionado linha a linha; sem sinais de quebra na estrutura. |
| ok | /admin/personas | Paginas admin (cockpit) | listAllPersonas + RPC article_counts_by_persona (admin client), togglePersona/deletePerson |
| ok | /admin/personas/nova e /admin/personas/[id] | Paginas admin (cockpit) | Nao inspecionado linha a linha. |
| ok | /admin/agentes | Paginas admin (cockpit) | Revogar/reativar via flag no form; coerente com o aviso de seguranca. |
| ok | /admin/autonomo | Paginas admin (cockpit) | Depende do radar vivo em 127.0.0.1:8100; degrada com erro claro se fora. _autopublish_tick |
| ok | /admin/ticker | Paginas admin (cockpit) | Fluxo completo e funcional. |
| ok | /admin/configuracoes | Paginas admin (cockpit) | Slot sem provider mostra 'Em breve' (estado parcial intencional, nao quebra). |
| ok | /admin/materias/nova | Paginas admin (cockpit) | Form reaproveitado entre nova e edicao (bom DRY). createArticle valida editoria/titulo/cor |
| ok | /admin/materias/importar | Paginas admin (cockpit) | Funciona; corpo vazio aceito (placeholder) pra reescrever depois. Depende da qualidade do  |
| ok | /api/ai/articles/[id]/publish (route.ts) | Paginas admin (cockpit) | Referencia para canPublish(). NAO flagged como problema isolado, citado so como o 4o camin |
| ok | GET /api/ai/ping | Rotas de API (gateway /a | ok. |
| ok | withAgent (wrapper) — src/lib/ai/with-agent.ts | Rotas de API (gateway /a | Base sólida e consistente em TODAS as rotas /api/ai. Detalhe menor: rate-limit conta agent |
| ok | GET /api/ai/articles | Rotas de API (gateway /a | ok. Escape de wildcard no q está correto. |
| ok | POST /api/ai/articles | Rotas de API (gateway /a | Funciona e é seguro (nunca publica). Há duplicação CONCEITUAL com createArticle (Server Ac |
| ok | GET /api/ai/articles/[id] | Rotas de API (gateway /a | ok. |
| ok | POST /api/ai/articles/[id]/update | Rotas de API (gateway /a | ok funcionalmente. updateArticle do admin edita TUDO inclusive status->published; este só  |
| ok | POST /api/ai/articles/[id]/seo | Rotas de API (gateway /a | ok. Nota: NÃO re-garante unicidade de slug (uniqueArticleSlug) ao trocar via SEO — o creat |
| ok | POST /api/ai/articles/[id]/review | Rotas de API (gateway /a | ok. Não escreve audit_log (as outras escrevem) — inconsistência menor de auditoria, não fu |
| ok | POST /api/ai/articles/[id]/unpublish | Rotas de API (gateway /a | ok. Mesma lógica do unpublishArticle do admin (published->draft). Duplicação simples e de  |
| ok | POST /api/ai/articles/[id]/archive | Rotas de API (gateway /a | ok. Não tem equivalente exato no admin (admin usa delete/reject) — funcionalidade própria  |
| ok | POST /api/ai/pauta/[id]/draft | Rotas de API (gateway /a | Funciona. Duplica o uso de draftFromScored com o admin (kickoffDraft). Diferença real: o a |
| ok | POST /api/ai/radar/[agent] | Rotas de API (gateway /a | ok. Operações potencialmente longas (pipeline) numa rota síncrona — mesma observação de ti |
| ok | POST /api/ai/radar/submit-url | Rotas de API (gateway /a | ok. Comentário no código confirma precedência da rota estática sobre [agent]. |
| ok | GET /api/ai/community | Rotas de API (gateway /a | ok. |
| ok | GET /api/ai/bazar | Rotas de API (gateway /a | ok. |
| ok | GET /api/ai/pendencias | Rotas de API (gateway /a | ok. Sobrepõe parcialmente analytics/daily (drafts, pauta) mas com recorte diferente (pendê |
| ok | POST /api/push/breaking | Rotas de API (gateway /a | ok e seguro (fail-closed). Reusa sendBreakingPush — não é duplicação ruim. Mas é a ÚNICA f |
| ok | POST /api/push/subscribe | Rotas de API (gateway /a | ok. Pública por design. Sem rate-limit/captcha — alguém pode inflar push_subscribers com e |
| ok | POST /api/push/unsubscribe | Rotas de API (gateway /a | ok. Qualquer um que saiba um endpoint pode desativá-lo, mas endpoints push são opacos/efêm |
| ok | GET /api/health | Rotas de API (gateway /a | ok. Usa createClient (anon) — se RLS bloquear o select anon, reporta 'fail' mesmo com banc |
| ok | GET /api/og | Rotas de API (gateway /a | ok. Fora do escopo declarado mas presente; público por design (OG). |
| ok | POST /api/social/render | Rotas de API (gateway /a | REBAIXADO de 'inseguro' para 'ok'. O flag nao se sustenta na pratica: em PROD com token e  |
| ok | rejectArticle (articles.ts:457) | Server Actions — editori | isStaff, update status=rejected, audita, revalida, redirect /admin/fila. ok. |
| ok | deleteArticle (articles.ts:588) | Server Actions — editori | Uso de service-role consciente e comentado; isStaff ja validou. |
| ok | toggleArticleHighlight (articles.ts:675) | Server Actions — editori | Limite de 3 e so sugestao de UI; aceitavel. Mesma area (curadoria de home) que o agente co |
| ok | createArticleFromImport (articles.ts:715) | Server Actions — editori | Parcialmente sobrepoe createArticle, mas o proposito (import com source_url, body opcional |
| ok | toggleMuralLike (community.ts:277) | Server Actions — editori | likes_count assume trigger no banco; o count retornado e o pos-update lido em seguida (pod |
| ok | markSocialPostPublished (social.ts:59) | Server Actions — editori | isStaff, update status=published+external_url+published_at, audita, revalida. ok. |
| ok | dismissSocialPost / restoreSocialPost / deleteSocialPost (so | Server Actions — editori | deleteSocialPost existe justamente porque o Distribuidor gera cards duplicados — sintoma d |
| ok | approvePackPending (social.ts:179) | Server Actions — editori | isStaff, busca pending por article_id, update em lote pra ready, audita, revalida. ok. |
| ok | regenerateSocialPack (social.ts:218) | Server Actions — editori | Unico publish-path que faz await sincrono do radar com erro propagado — contraste positivo |
| ok | generateVariations (media-studio.ts:63) | Server Actions — midia/e | Compartilha o motor generateImage com generateHeroVariations e generatePack — aqui a dupli |
| ok | generateHeroVariations (media-studio.ts:133) | Server Actions — midia/e | Unica action do grupo com try/catch retornando {ok:false} em vez de throw — inconsistente  |
| ok | applySocialKitTemplate (media-studio.ts:230) | Server Actions — midia/e | originForRender monta a URL do proprio app via NEXT_PUBLIC_SITE_URL/PORT — fragil em deplo |
| ok | clearPostMedia (media-studio.ts:1122) | Server Actions — midia/e | Faz. update admin media_url=null status=pending, audita. Chamado por canvas-reframer.tsx:1 |
| ok | applyVariation (media-studio.ts:617) | Server Actions — midia/e | Comentario cita 'undo na Fase D (history-studio)' — o undo nao existe ainda, so o log fica |
| ok | updateVisualSlots (visual-slots.ts:17) | Server Actions — midia/e | Nao audita (de proposito, e auto-save). OK. |
| ok | resetVisualSlots (visual-slots.ts:49) | Server Actions — midia/e | Faz. Le editoria/cities/tags/title, deriva, salva, audita. Chamado por slot-studio.tsx:117 |
| ok | updateSocialCaption (studio.ts:51) | Server Actions — midia/e | Faz. Trim a direita, corta em 2200, update, audita, revalida estudio. Chamado por caption- |
| ok | updateSocialHashtags (studio.ts:87) | Server Actions — midia/e | Faz, sanitizacao boa (regex unicode, dedup, slice 30). Chamado por hashtags-editor.tsx:44. |
| ok | src/lib/actions/pipeline.ts › triggerCollectAll | Server Actions — operaca | Wired em /admin. Depende do radar estar de pé (127.0.0.1:8100); se cair, throw vira erro d |
| ok | src/lib/actions/pipeline.ts › triggerCollectSource | Server Actions — operaca | Wired em /admin (form por fonte). |
| ok | src/lib/actions/pipeline.ts › triggerAnalista | Server Actions — operaca | Wired em /admin. Sem par em /api/ai/radar (a rota só conhece curador/investigador/redator/ |
| ok | src/lib/actions/scheduler.ts › triggerSchedulerStart | Server Actions — operaca | Wired em /admin/autonomo. Só liga se SCHEDULE_ENABLED=true no radar (senão volta running:f |
| ok | src/lib/actions/scheduler.ts › triggerSchedulerStop | Server Actions — operaca | Wired em /admin/autonomo. |
| ok | src/lib/actions/scheduler.ts › triggerSchedulerRunJob | Server Actions — operaca | Wired em /admin/autonomo (botão 'Rodar agora' por job). Conceitualmente sobrepõe os trigge |
| ok | src/lib/actions/sources.ts › createSource | Server Actions — operaca | Validação sólida. Usa client normal (não admin) — depende de RLS permitir staff escrever e |
| ok | src/lib/actions/sources.ts › updateSource | Server Actions — operaca | Lógica de merge de config correta (mantém campos custom, dropa url/filters quando vazios). |
| ok | src/lib/actions/sources.ts › toggleSource / resetSourceError | Server Actions — operaca | OK. |
| ok | src/lib/actions/sources.ts › deleteSource | Server Actions — operaca | Trava de integridade boa (preserva histórico via FK). |
| ok | src/lib/actions/curator.ts › updateCuratorRubric | Server Actions — operaca | Wired em /admin/curador/form.tsx. Usa admin client. Lógica de versionamento clara. Único p |
| ok | src/lib/actions/personas.ts › createPersona / updatePersona  | Server Actions — operaca | Wired em /admin/personas. Validações e trava de histórico OK. |
| ok | src/lib/actions/personas.ts › rewriteArticleWithPersona | Server Actions — operaca | Wired em /admin/materias/[id]/persona-rewriter.tsx. Robusto: parse defensivo, cascata soci |
| ok | src/lib/actions/agents.ts › listAgents / createAgent / setAg | Server Actions — operaca | Wired em /admin/agentes. Correto: só admin (não editor), hash-only, cascade manual de agen |
| ok | src/lib/actions/ticker.ts › createTickerMessage / updateTick | Server Actions — operaca | Wired em /admin/ticker. Sem audit_log (diferente das outras actions de operação) — inconsi |
| ok | src/lib/actions/auth.ts › signInWithGoogle | Server Actions — operaca | Wired (auth-modal/login). safeNext bloqueia open-redirect (só paths internos). OK. |
| ok | src/lib/actions/auth.ts › sendEmailMagicLink / sendPhoneOtp  | Server Actions — operaca | Wired em /login (email-form, phone-form). Validação de telefone BR e token OK. Sem rate-li |
| ok | src/lib/actions/auth.ts › signOut | Server Actions — operaca | Wired no header/menu. |
| ok | src/lib/actions/my-account.ts › setBazarItemStatus / deleteB | Server Actions — operaca | Wired em /minha-conta (bazar-row, mural-row). Dupla checagem de ownership (na leitura e no |
| ok | src/lib/actions/auto-adapt.ts › autoAdaptCaptionsToAllChanne | Server Actions — operaca | Wired em /admin/estudio (auto-adapt-button). Funciona. Inconsistência menor: grava model/t |
| ok | src/lib/actions/pipeline.ts › triggerCurador | Server Actions — operaca | REBAIXADO de 'duplicado' p/ 'ok'. Confirmei: o 2o entrypoint (/api/ai/radar/[agent]?curado |
| ok | src/lib/actions/pipeline.ts › triggerInvestigador | Server Actions — operaca | REBAIXADO de 'duplicado' p/ 'ok'. Mesmo caso do triggerCurador: a rota /api/ai/radar/[agen |
| ok | src/lib/actions/pipeline.ts › triggerRedator | Server Actions — operaca | REBAIXADO de 'duplicado' p/ 'ok'. /api/ai/radar/[agent]?redator chama o mesmo runRedator ( |
| ok | src/lib/actions/pipeline.ts › triggerPipelineAll | Server Actions — operaca | REBAIXADO de 'duplicado' p/ 'ok'. /api/ai/radar/[agent]?pipeline chama o mesmo runPipeline |
| ok | src/lib/actions/auth.ts › signInAsDev | Server Actions — operaca | REBAIXADO de 'parcial' p/ 'ok'. Funciona corretamente e está bem-gated (env de prod + pres |
| ok | GET /health | Endpoints do radar (Pyth | Unico GET sem efeito colateral. ok. |
| ok | POST /collect/run/{source_id} | Endpoints do radar (Pyth | Chamado por runCollectSource <- triggerCollectSource. Unico que valida 404. ok. |
| ok | POST /collect/submit-url | Endpoints do radar (Pyth | Cadeia: MCP tools/radar.py -> /api/ai/radar/submit-url (route TS, withAgent) -> submitUrlT |
| ok | POST /pipeline/draft/{scored_item_id} | Endpoints do radar (Pyth | Melhor endpoint do grupo (idempotente, com trava de reject). Chamado por draftFromScored < |
| ok | GET /scheduler/status | Endpoints do radar (Pyth | Chamado por getSchedulerStatus <- /admin/autonomo. Unico GET do grupo alem de health. ok. |
| ok | zimbanet_ping (server.py) -> GET /api/ai/ping | Ferramentas MCP (as 25 d | E2E ok. Unica tool sem checagem de resource — proposital (so valida token). |
| ok | list_drafts (server.py) -> GET /api/ai/articles?status=&limi | Ferramentas MCP (as 25 d | client.get /api/ai/articles; rota existe, GET resource='articles' read. Funciona pra qualq |
| ok | get_article (server.py) -> GET /api/ai/articles/{id} | Ferramentas MCP (as 25 d | client.get /api/ai/articles/{id}; rota existe (FULL_FIELDS), resource='articles' read |
| ok | update_article (server.py) -> POST /api/ai/articles/{id}/upd | Ferramentas MCP (as 25 d | docstring lista 'reading_minutes' etc; o filtro real e pickFields(CONTENT_FIELDS). Campos  |
| ok | update_seo (server.py) -> POST /api/ai/articles/{id}/seo | Ferramentas MCP (as 25 d | tags aqui (resource 'slug') e tags em update_article (resource 'article_content') sao dois |
| ok | submit_review (server.py) -> POST /api/ai/articles/{id}/revi | Ferramentas MCP (as 25 d | client.post .../review; rota existe, so status=='draft' -> 'review', resource='article_con |
| ok | definir_imagem (server.py) -> POST /api/ai/articles/{id}/her | Ferramentas MCP (as 25 d | Funciona com preset editor. A definicao de hero existe em multiplos lugares no codebase —  |
| ok | buscar_materias (server.py) -> GET /api/ai/articles?status=& | Ferramentas MCP (as 25 d | Mesma rota que list_drafts — duas tools, mesmo endpoint. Aceitavel (q opcional), mas e a m |
| ok | LOGICA: finalizar (Visual + Distribuidor) pos-publicacao | DUPLICACAO transversal ( | Fonte unica de fato (lib/radar.ts/FastAPI). Unica duplicacao e o wrapper .catch(warn) repe |