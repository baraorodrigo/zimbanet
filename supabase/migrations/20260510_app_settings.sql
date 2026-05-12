-- ============================================================
-- ZIMBANET — App settings (chaves de API rotacionáveis no admin)
-- Tabela key/value pra segredos que o admin precisa trocar sem
-- mexer no .env (ex: ANTHROPIC_API_KEY, OPENROUTER_API_KEY, FAL_KEY).
-- Acesso só via service_role — RLS habilitado, zero policy =
-- bloqueio total pro client anon. O server lê via admin client.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE app_settings IS
  'Segredos rotacionáveis pelo admin (chaves de provider de IA, etc). Sem RLS policies = bloqueado pro anon; só service_role lê/escreve.';
