-- ============================================================
-- ZIMBANET — Personas editoriais
-- 4 vozes da redação configuráveis pelo admin. Cada matéria pode
-- ser reescrita "sob a voz" de uma persona, escolhida no Estúdio
-- ou na página de edição. A persona escolhida fica gravada em
-- articles.persona_id pra reproduzir a próxima reescrita.
-- ============================================================

create table if not exists public.editorial_personas (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  headline        text,
  description     text,
  system_prompt   text not null,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ix_editorial_personas_active
  on public.editorial_personas(is_active, sort_order);

drop trigger if exists set_updated_at_personas on public.editorial_personas;
create trigger set_updated_at_personas before update on public.editorial_personas
  for each row execute function public.tg_set_updated_at();

alter table public.editorial_personas enable row level security;
-- Sem policy = bloqueado pra anon/authenticated. Só service_role lê/escreve.

-- articles ganha referência à última persona usada na reescrita.
alter table public.articles
  add column if not exists persona_id uuid
    references public.editorial_personas(id) on delete set null;

create index if not exists ix_articles_persona_id
  on public.articles(persona_id);
