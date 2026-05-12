-- ============================================================
-- ZIMBANET — Ticker editorial (barra vermelha)
-- Mensagens controladas pelo editor que rolam no marquee abaixo
-- do header. Se houver alguma ativa, o ticker usa só essas; senão
-- cai no fallback automático (últimas matérias do dia).
-- ============================================================

create table if not exists public.ticker_messages (
  id           uuid primary key default gen_random_uuid(),
  text         text not null,
  link         text,
  kicker       text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ix_ticker_messages_active
  on public.ticker_messages(is_active, sort_order, created_at desc);

drop trigger if exists set_updated_at_ticker on public.ticker_messages;
create trigger set_updated_at_ticker before update on public.ticker_messages
  for each row execute function public.tg_set_updated_at();

alter table public.ticker_messages enable row level security;
-- Sem policy = bloqueado pra anon/authenticated. Só service_role lê/escreve.
-- Leitura pública vai pelo server (createClient com service-role ou via SSR).

-- Policy de leitura pública das ativas — o ticker é mostrado no portal anônimo.
drop policy if exists ticker_messages_read_active on public.ticker_messages;
create policy ticker_messages_read_active on public.ticker_messages
  for select to anon, authenticated
  using (is_active = true);
