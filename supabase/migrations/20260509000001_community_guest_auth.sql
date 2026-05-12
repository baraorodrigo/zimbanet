-- =============================================================================
-- Community guest auth — #zimbamilgrau e #bazardazimba sem login obrigatório
-- =============================================================================
-- UX-first: usuário publica primeiro, confirma email depois (magic link).
-- Posts/itens ficam em status='pending_confirmation' até clicar no link.
-- Defensivo: cria tabelas se não existirem; senão só adiciona colunas novas.
-- =============================================================================

-- 1) MURAL_POSTS ---------------------------------------------------------------

create table if not exists public.mural_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  pending_email text,
  author_name text not null,
  is_anon boolean not null default false,
  bairro text not null,
  body text not null,
  status text not null default 'published'
    check (status in ('pending_confirmation', 'published', 'removed')),
  moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint mural_posts_owner_chk check (user_id is not null or pending_email is not null)
);

alter table public.mural_posts add column if not exists pending_email text;
alter table public.mural_posts add column if not exists status text;
update public.mural_posts set status = coalesce(status, 'published');
alter table public.mural_posts alter column status set default 'published';
alter table public.mural_posts alter column status set not null;
alter table public.mural_posts add column if not exists published_at timestamptz;
update public.mural_posts set published_at = coalesce(published_at, created_at) where status = 'published';

-- relax author_name when guest
alter table public.mural_posts alter column user_id drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mural_posts_status_chk') then
    alter table public.mural_posts add constraint mural_posts_status_chk
      check (status in ('pending_confirmation', 'published', 'removed'));
  end if;
end $$;

create index if not exists mural_posts_pending_email_idx
  on public.mural_posts (pending_email) where status = 'pending_confirmation';
create index if not exists mural_posts_published_idx
  on public.mural_posts (published_at desc) where status = 'published';

-- 2) BAZAR_ITEMS --------------------------------------------------------------

create table if not exists public.bazar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  pending_email text,
  type text not null check (type in ('Vende', 'Doa', 'Troca', 'Procura')),
  category text,
  title text not null,
  description text not null,
  price_cents integer,
  price_label text,
  bairro text not null,
  whatsapp text not null,
  status text not null default 'active'
    check (status in ('pending_confirmation', 'active', 'sold', 'removed')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint bazar_items_owner_chk check (user_id is not null or pending_email is not null)
);

alter table public.bazar_items add column if not exists pending_email text;
alter table public.bazar_items add column if not exists published_at timestamptz;
update public.bazar_items set published_at = coalesce(published_at, created_at) where status = 'active';

-- if old constraint exists with reduced statuses, drop and recreate
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'bazar_items_status_check') then
    alter table public.bazar_items drop constraint bazar_items_status_check;
  end if;
  alter table public.bazar_items add constraint bazar_items_status_check
    check (status in ('pending_confirmation', 'active', 'sold', 'removed'));
exception when duplicate_object then null;
end $$;

alter table public.bazar_items alter column user_id drop not null;

create index if not exists bazar_items_pending_email_idx
  on public.bazar_items (pending_email) where status = 'pending_confirmation';
create index if not exists bazar_items_active_idx
  on public.bazar_items (published_at desc) where status = 'active';

-- 3) RLS — anônimos veem só publicado, autores veem o próprio ----------------

alter table public.mural_posts enable row level security;
alter table public.bazar_items enable row level security;

drop policy if exists "mural read published" on public.mural_posts;
create policy "mural read published"
  on public.mural_posts for select
  using (status = 'published');

drop policy if exists "mural read own" on public.mural_posts;
create policy "mural read own"
  on public.mural_posts for select
  using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "bazar read active" on public.bazar_items;
create policy "bazar read active"
  on public.bazar_items for select
  using (status in ('active', 'sold'));

drop policy if exists "bazar read own" on public.bazar_items;
create policy "bazar read own"
  on public.bazar_items for select
  using (auth.uid() is not null and user_id = auth.uid());

-- 4) Trigger: quando email é confirmado, anexa posts/itens pendentes ---------

create or replace function public.claim_pending_community_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- mural
  update public.mural_posts
    set user_id = new.id,
        status = 'published',
        pending_email = null,
        published_at = coalesce(published_at, now())
    where lower(pending_email) = lower(new.email)
      and status = 'pending_confirmation';

  -- bazar
  update public.bazar_items
    set user_id = new.id,
        status = 'active',
        pending_email = null,
        published_at = coalesce(published_at, now())
    where lower(pending_email) = lower(new.email)
      and status = 'pending_confirmation';

  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.claim_pending_community_content();

drop trigger if exists on_auth_user_created_claim on auth.users;
create trigger on_auth_user_created_claim
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.claim_pending_community_content();
