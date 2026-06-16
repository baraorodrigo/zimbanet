# Radar → OpenRouter (motores na config do site) — Design

**Data:** 2026-06-16
**Branch:** `restauracao-16maio`

## Problema

Os 5 motores de IA do radar (Curador, Investigador, Redator, Visual, Analista)
estão amarrados **só à Anthropic**, com modelos fixos em `radar/app/config.py` e
chave própria (`ANTHROPIC_API_KEY`). Eles **não leem** a config de IA do site
(`/admin/configuracoes`), que já aponta pro OpenRouter com modelos baratos.

Consequência: a config nova de OpenRouter não chega nos motores; eles continuam
dependendo da chave Anthropic cara, e falham se ela estiver vazia/sem crédito.

Bug adicional: `scheduler.py:112` chama `supabase_client.get_supabase()` (método
inexistente) em vez de `supabase_client()` — derruba o `redator_tick` sempre.

## Objetivo

Ensinar o radar a ler a **mesma** config do site (slots `text_main` e
`text_fast` em `app_settings`) e a falar com o **OpenRouter** (API compatível com
OpenAI), com *fallback* pra Anthropic+env se os slots estiverem vazios (nada
quebra). Config num lugar só: o painel do site.

## Mapa motor → slot

| Motor | Slot | Razão |
|---|---|---|
| Curador, Visual, Analista | `text_fast` | tarefas baratas/frequentes |
| Investigador, Redator | `text_main` | precisa de qualidade |
| Coletor, autopublish | — | não usam IA |

## Componentes

### 1. `radar/app/llm/resolve.py` (novo)
Espelho do `resolve.ts` do site. Função `resolve_slot(slot: str) -> ResolvedModel`
com `{provider, model_id, api_key}`.

- Lê `slot:{slot}:model` e `slot:{slot}:key` de `app_settings` (via
  `supabase_client()`, service-role).
- Parse do model choice: prefixo `openrouter:` → provider openrouter, `anthropic:`
  → anthropic. `model_id` = string sem o prefixo.
- Chave: 1) `slot:{slot}:key` do banco → 2) env por provider
  (`OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`).
- **Fallback total:** se o slot não tem modelo escolhido, usa o default Anthropic
  do `config.py` (`model_curador` etc.) + `anthropic_api_key`. Assim o
  comportamento de hoje continua se ninguém configurou nada.
- Erros do banco (indisponível) → cai pro fallback, não explode.

### 2. `radar/app/llm/client.py` (modificar)
`call_with_tool` passa a aceitar `slot: str` em vez de `model: str`. Internamente
chama `resolve_slot(slot)` e despacha por provider:

- **anthropic** → caminho atual (`anthropic_client()` com a chave resolvida;
  hoje usa o client cacheado — passar a criar client com a chave resolvida).
- **openrouter** → POST `https://openrouter.ai/api/v1/chat/completions` via
  `httpx`, formato OpenAI com *function calling*:
  - `tools=[{"type":"function","function":{name, description, parameters: schema}}]`
  - `tool_choice={"type":"function","function":{"name": tool_name}}`
  - resposta: `choices[0].message.tool_calls[0].function.arguments` (JSON string)
    → `json.loads`.
  - **Plano B:** se não vier `tool_calls`, tentar extrair JSON de
    `choices[0].message.content` (alguns modelos respondem em texto). Se falhar,
    levanta erro (o tick loga, como hoje).
  - headers: `Authorization: Bearer <key>`, `HTTP-Referer`/`X-Title` opcionais.
  - usage: `response.usage.prompt_tokens`/`completion_tokens`.
- Retry (`tenacity`) estendido pra erros 429/5xx do OpenRouter (`httpx` status).
- Retorna o mesmo `LLMResult` nos dois caminhos.

### 3. Agentes (modificar — 1 linha cada)
Trocar `model=settings.model_xxx` por `slot="text_fast"` ou `slot="text_main"`:
- `curador.py` → `text_fast`
- `visual.py` → `text_fast`
- `analista.py` → `text_fast`
- `investigador.py` → `text_main`
- `redator.py` → `text_main`

### 4. `radar/app/llm/pricing.py` (modificar)
Acrescentar preços aproximados de DeepSeek V4 Flash/Pro. Modelo desconhecido →
custo 0 (já é o comportamento). Só observabilidade.

### 5. `radar/app/scheduler.py:112` (corrigir bug)
`supabase_client.get_supabase()` → `supabase_client()`.

## Fluxo de dados

```
agente → call_with_tool(slot="text_fast")
       → resolve_slot lê app_settings (slot:text_fast:model/key)
       → provider=openrouter, model=deepseek/deepseek-v4-flash, key=sk-or-...
       → httpx POST OpenRouter (function calling) → JSON estruturado
       → LLMResult (igual ao caminho Anthropic)
```

## Config (feita no painel, sem deploy)
- `text_fast` → `openrouter:deepseek/deepseek-v4-flash` + chave OpenRouter
- `text_main` → `openrouter:deepseek/deepseek-v4-pro` + chave OpenRouter

Defaults serão semeados em `app_settings` via Supabase pra ficar turnkey.

## Erros & resiliência
- Slot vazio → fallback Anthropic+env (não quebra).
- Banco indisponível → fallback Anthropic+env.
- Modelo não devolve tool_call → plano B (JSON do content) → senão erro logado no tick.
- Rate limit / 5xx → retry exponencial (tenacity), igual hoje.

## Testes
- `resolve_slot`: openrouter, anthropic, slot vazio (fallback), chave do banco vs env.
- `call_with_tool` openrouter: parse de `tool_calls`; plano B de JSON no content;
  erro quando nenhum dos dois. Mockar httpx com `respx`.
- Caminho anthropic continua passando (regressão).

## Fora de escopo (YAGNI)
- Controles separados por motor (reaproveita text_main/text_fast).
- Slots image/video (continuam como estão).
- Qualquer mudança no portal Next.js.
