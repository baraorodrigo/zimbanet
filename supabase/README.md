# Supabase — schema do Content Engine

Esta pasta contém a migration que cria as tabelas do **ZIMBANET Content Engine** no Supabase do portal (project ref `gavgzpbqrryepgqxzvdk`).

## Por que esse arquivo existe e não foi aplicado automaticamente

O Supabase MCP do Claude está logado em `baraorodrigo's Org`, mas o project apontado por `.env.local` (`https://gavgzpbqrryepgqxzvdk.supabase.co`) está em outra org/conta. Sem service-role key, eu não consigo aplicar DDL remoto. Você roda manual e ficamos prontos pra Fase 2.

## Como aplicar

### Opção A — SQL Editor (mais rápido)

1. Abra https://supabase.com/dashboard/project/gavgzpbqrryepgqxzvdk/sql/new
2. Cole o conteúdo de `migrations/20260508000001_content_engine_schema.sql`
3. Run

### Opção B — Supabase CLI

```bash
cd zimbanet-portal
npx supabase login
npx supabase link --project-ref gavgzpbqrryepgqxzvdk
npx supabase db push
```

### Storage buckets (criar pelo dashboard)

Em **Storage → New bucket** (todos com **Public** = ON):

| Bucket | Uso |
|---|---|
| `article-images` | hero/inline dos artigos |
| `social-cards` | cards 1080×1080 / story / banner gerados pela template engine |
| `post-media` | uploads do #zimbamilgrau |
| `listing-images` | fotos de itens do #bazardazimba |
| `acervo` | banco próprio de fotos da região |

## O que o schema entrega

- `sources` · `raw_items` · `scored_items` — espelho do radar-regional (mesma estrutura da `001_initial_schema.py`, com colunas extras `editoria`, `decision`, `image_url`, `priority`)
- `enriched_items` — output do **Investigador** (Sonnet)
- **`articles`** — output do **Redator** (Sonnet) → tabela que o portal Next.js consulta
- **`social_posts`** — 1 article gera N posts (1 por canal: IG feed/story/carousel, FB, WhatsApp, Telegram, Push)
- `visual_templates` — HTML/CSS por formato pra Puppeteer renderizar
- `audit_log` — imutável, rastreia tokens/custo/decisões por agente

## RLS

- `articles` e `social_posts` com `status = 'published'` → leitura pública (anon)
- Demais tabelas → bloqueadas pra anon; só service-role escreve/lê
- O radar-regional (Python) usa a `SUPABASE_SERVICE_ROLE_KEY` para escrever

## Próximos passos depois de aplicar

1. Adicione no `.env.local` do portal: `SUPABASE_SERVICE_ROLE_KEY=...` (só pra Server Actions futuras)
2. No `radar-regional antigo/.env`: `ZIMBANET_SUPABASE_URL=...` + `ZIMBANET_SUPABASE_SERVICE_ROLE_KEY=...`
3. Fase 2 começa: rebrand BOMBEI → ZIMBANET no radar e adicionar o publisher Supabase em `src/pipeline/publisher_supabase.py`
