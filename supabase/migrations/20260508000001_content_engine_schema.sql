-- ============================================================
-- ZIMBANET Content Engine — schema bridge
-- Compatível com radar-regional (Python) escrevendo via service-role
-- e portal Next.js lendo via anon (RLS allow-read em articles/social_posts)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- 1. SOURCES — feeds de origem (RSS, scrapers, APIs)
-- ============================================================
create table if not exists public.sources (
  id              text primary key,
  name            text not null,
  type            text not null check (type in ('rss','scraper','api','social','google_alerts')),
  config          jsonb not null default '{}'::jsonb,
  city            text not null,
  priority        text not null default 'medium' check (priority in ('high','medium','low')),
  active          boolean not null default true,
  last_fetched_at timestamptz,
  error_count     integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 2. RAW_ITEMS — matérias coletadas brutas (com dedup hashes)
-- ============================================================
create table if not exists public.raw_items (
  id              text primary key,
  source_id       text not null references public.sources(id),
  title           text not null,
  body            text,
  url             text not null unique,
  image_url       text,
  published_at    timestamptz,
  raw_html        text,
  fetched_at      timestamptz not null default now(),
  content_hash    text not null,
  semantic_hash   text not null,
  is_duplicate    boolean not null default false,
  duplicate_of    text references public.raw_items(id)
);
create index if not exists ix_raw_items_content_hash  on public.raw_items(content_hash);
create index if not exists ix_raw_items_semantic_hash on public.raw_items(semantic_hash);
create index if not exists ix_raw_items_source_fetch  on public.raw_items(source_id, fetched_at desc);

-- ============================================================
-- 3. SCORED_ITEMS — Curador (Haiku) triagem
-- ============================================================
create table if not exists public.scored_items (
  id                     text primary key,
  raw_item_id            text not null unique references public.raw_items(id),
  relevance_score        real,
  virality_score         real,
  risk_score             real,
  risk_flags             text[],
  editoria               text,
  classification         text,
  decision               text check (decision in ('approve','reject','investigate')),
  ai_reasoning           text,
  prompt_version         text,
  status                 text not null,
  scored_at              timestamptz not null default now()
);
create index if not exists ix_scored_items_status   on public.scored_items(status);
create index if not exists ix_scored_items_decision on public.scored_items(decision);

-- ============================================================
-- 4. ENRICHED_ITEMS — Investigador (Sonnet) — só roda quando decision=investigate
-- ============================================================
create table if not exists public.enriched_items (
  id                  uuid primary key default gen_random_uuid(),
  scored_item_id      text not null unique references public.scored_items(id),
  briefing            text not null,
  fact_check          jsonb default '{}'::jsonb,
  historical_context  text,
  stakeholders        jsonb default '[]'::jsonb,
  photo_suggestions   jsonb default '[]'::jsonb,
  web_searches        jsonb default '[]'::jsonb,
  confidence          real,
  prompt_version      text,
  enriched_at         timestamptz not null default now()
);

-- ============================================================
-- 5. ARTICLES — Redator (Sonnet) — artigo completo do portal
-- Esta é a tabela que o PORTAL CONSULTA pra montar a homepage
-- ============================================================
create table if not exists public.articles (
  id                 uuid primary key default gen_random_uuid(),
  scored_item_id     text references public.scored_items(id),
  enriched_item_id   uuid references public.enriched_items(id),

  slug               text not null unique,
  editoria           text not null check (editoria in (
    'cidade','politica','esporte','cultura','policia','praias','economia','opiniao'
  )),
  kicker             text,
  title              text not null,
  subtitle           text,
  lede               text,
  body               text not null,
  byline             text,
  reading_minutes    integer,

  hero_image_url     text,
  hero_image_credit  text,
  hero_image_alt     text,

  tags               text[] default '{}',
  cities             text[] default '{}',
  is_breaking        boolean not null default false,
  is_exclusive       boolean not null default false,

  status             text not null default 'draft' check (status in (
    'draft','review','scheduled','published','archived','rejected'
  )),
  risk_score         real,
  confidence         real,
  auto_published     boolean not null default false,

  prompt_version     text,
  scheduled_at       timestamptz,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ix_articles_status_pub   on public.articles(status, published_at desc);
create index if not exists ix_articles_editoria     on public.articles(editoria, published_at desc);
create index if not exists ix_articles_breaking     on public.articles(is_breaking) where is_breaking;
create index if not exists ix_articles_slug         on public.articles(slug);

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists set_updated_at on public.articles;
create trigger set_updated_at before update on public.articles
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- 6. SOCIAL_POSTS — 1 article gera N posts (1 por canal)
-- ============================================================
create table if not exists public.social_posts (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid not null references public.articles(id) on delete cascade,

  channel         text not null check (channel in (
    'instagram_feed','instagram_story','instagram_carousel',
    'facebook','whatsapp','telegram','push'
  )),
  format          text not null check (format in (
    'card_1080','story_1080x1920','carousel_slide','banner_1200x630','text_only'
  )),

  caption         text,
  hashtags        text[] default '{}',
  body_html       text,
  text_short      text,

  media_url       text,
  media_path      text,
  template_id     text,

  status          text not null default 'pending' check (status in (
    'pending','generating','ready','scheduled','published','failed'
  )),
  scheduled_at    timestamptz,
  published_at    timestamptz,
  external_id     text,
  external_url    text,
  error_message   text,

  prompt_version  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ix_social_posts_article on public.social_posts(article_id);
create index if not exists ix_social_posts_status  on public.social_posts(status, scheduled_at);
drop trigger if exists set_updated_at_social on public.social_posts;
create trigger set_updated_at_social before update on public.social_posts
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- 7. VISUAL_TEMPLATES — engine HTML/CSS por formato
-- ============================================================
create table if not exists public.visual_templates (
  id            text primary key,
  name          text not null,
  format        text not null,
  width         integer not null,
  height        integer not null,
  html          text not null,
  css           text not null,
  variables     jsonb default '[]'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 8. AUDIT_LOG — imutável; rastreia tokens, custos, decisões
-- ============================================================
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,
  entity_id     text not null,
  action        text not null,
  actor         text not null,
  agent         text,
  model         text,
  prompt_version text,
  tokens_in     integer,
  tokens_out    integer,
  cost_usd      numeric(10,6),
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists ix_audit_log_entity_id  on public.audit_log(entity_id);
create index if not exists ix_audit_log_created_at on public.audit_log(created_at desc);
create index if not exists ix_audit_log_actor      on public.audit_log(actor);

create or replace function public.prevent_audit_log_modification()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log é imutável — operação % negada', tg_op;
end $$;
drop trigger if exists audit_log_immutable on public.audit_log;
create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_log_modification();

-- ============================================================
-- RLS — portal lê (anon) artigos publicados; service-role escreve tudo
-- ============================================================
alter table public.articles      enable row level security;
alter table public.social_posts  enable row level security;
alter table public.sources       enable row level security;
alter table public.raw_items     enable row level security;
alter table public.scored_items  enable row level security;
alter table public.enriched_items enable row level security;
alter table public.visual_templates enable row level security;
alter table public.audit_log     enable row level security;

-- Articles publicados = público
drop policy if exists "articles_published_readable" on public.articles;
create policy "articles_published_readable"
  on public.articles for select
  using (status = 'published');

-- Social posts publicados = público
drop policy if exists "social_posts_published_readable" on public.social_posts;
create policy "social_posts_published_readable"
  on public.social_posts for select
  using (status = 'published');

-- Demais tabelas: somente service-role (sem policy = bloqueado pra anon/authenticated)

-- ============================================================
-- STORAGE BUCKETS (declarativo — criar via dashboard se não existirem)
-- ============================================================
-- Run separately in SQL Editor (storage schema):
--   article-images   (public read)
--   social-cards     (public read, gerados pela template engine)
--   post-media       (public read, uploads de #zimbamilgrau)
--   listing-images   (public read, #bazardazimba)
--   acervo           (public read, banco de fotos da região)
