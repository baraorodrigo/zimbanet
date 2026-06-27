-- Fase 1 (blindagem). Dois consertos de "não-versionado / fail-open":
--
-- 1) is_admin() existia no banco (referenciada por policies de RLS em 0001_agents
--    e alterada em 20260511_harden_functions_search_path) mas o CREATE dela NUNCA
--    esteve numa migration. Num restore/banco novo as policies referenciariam uma
--    função inexistente e o RBAC do painel cairia silenciosamente. Aqui versionamos
--    o corpo EXATO que roda hoje (create or replace = idempotente; não toca policies).
--    (is_staff() não é função SQL — é só TS em src/lib/auth/admin.ts — então não entra.)
--
-- 2) agent_autopublish_enabled: kill-switch do autopublish do agente. A rota
--    /api/ai/articles/[id]/publish virou FAIL-CLOSED (só publica se = 'true').
--    Seedamos 'true' (fase de teste). ON CONFLICT DO NOTHING: não sobrescreve se
--    alguém já desligou na mão.

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

insert into public.app_settings (key, value)
values ('agent_autopublish_enabled', 'true')
on conflict (key) do nothing;
