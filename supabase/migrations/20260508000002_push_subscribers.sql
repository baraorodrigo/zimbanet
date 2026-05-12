-- ZIMBANET — push_subscribers (Web Push VAPID)
-- Cada navegador/PWA opta in via /api/push/subscribe; o radar lê pra disparar
-- notificações via pywebpush.

create table if not exists public.push_subscribers (
  id           uuid primary key default gen_random_uuid(),
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  -- editorias opt-in. array vazio = todas. ex: ['cidade','esporte']
  editorias    text[] not null default '{}',
  active       boolean not null default true,
  user_id      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists push_subscribers_active_idx on public.push_subscribers(active) where active;
create index if not exists push_subscribers_user_idx on public.push_subscribers(user_id) where user_id is not null;
create index if not exists push_subscribers_editorias_gin on public.push_subscribers using gin (editorias);

create trigger push_subscribers_set_updated_at
  before update on public.push_subscribers
  for each row execute function public.tg_set_updated_at();

alter table public.push_subscribers enable row level security;

-- Anon pode INSERIR (subscribe via /api/push/subscribe) e UPDATE (toggle editorias)
-- desde que reuse a mesma row pelo endpoint. Service role bypassa.
create policy push_subscribers_insert_anon on public.push_subscribers
  for insert to anon, authenticated
  with check (true);

create policy push_subscribers_update_anon on public.push_subscribers
  for update to anon, authenticated
  using (true)
  with check (true);

-- Não há SELECT pra anon — só service role (pywebpush) lê a lista.
