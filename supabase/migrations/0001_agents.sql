-- Fase 0 do AI Gateway: agentes (token + permissões) e auditoria de execução.
create table if not exists agents (
  id                  text primary key,
  name                text not null,
  type                text not null,
  token_hash          text not null unique,
  permissions         jsonb not null default '{}'::jsonb,
  rate_limit_per_hour int  not null default 120,
  active              boolean not null default true,
  last_used_at        timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists agents_token_hash_idx on agents (token_hash);

create table if not exists agent_runs (
  id          uuid primary key default gen_random_uuid(),
  agent_id    text references agents(id) on delete set null,
  tool        text,
  action      text,
  resource    text,
  status      text not null,
  detail      jsonb,
  tokens_in   int default 0,
  tokens_out  int default 0,
  cost_usd    numeric default 0,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_agent_started_idx on agent_runs (agent_id, started_at desc);

alter table agents     enable row level security;
alter table agent_runs enable row level security;
create policy agents_admin_all     on agents     for all to authenticated using (public.is_admin());
create policy agent_runs_admin_all on agent_runs for all to authenticated using (public.is_admin());
