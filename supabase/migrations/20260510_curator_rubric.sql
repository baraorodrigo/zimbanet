-- Rubrica configurável do Curador (Haiku). O motor (zimbanet-radar) lê
-- a row ativa e injeta os blocos no prompt-sistema antes de classificar.
-- Mantemos só uma rubrica ativa por vez (unique partial index).

create table if not exists public.curator_rubric (
  id                 uuid primary key default gen_random_uuid(),
  prompt_version     integer not null default 1,
  editorial_voice    text,
  relevance_rules    text not null,
  virality_rules     text not null,
  risk_rules         text not null,
  focus_cities       text[] not null default array[]::text[],
  trigger_keywords   text[] not null default array[]::text[],
  block_keywords     text[] not null default array[]::text[],
  notes              text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         text
);

create unique index if not exists ux_curator_rubric_one_active
  on public.curator_rubric (is_active) where is_active = true;

create or replace function public.tg_curator_rubric_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_curator_rubric_updated_at on public.curator_rubric;
create trigger trg_curator_rubric_updated_at
  before update on public.curator_rubric
  for each row execute function public.tg_curator_rubric_updated_at();

alter table public.curator_rubric enable row level security;
-- service_role only (sem policy)
