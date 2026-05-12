-- =============================================================================
-- Remoção de policies permissivas em newsletter e push_subscribers
-- =============================================================================
-- Aplicado via MCP em 2026-05-11. Documenta em arquivo pra rastreio.
--
-- Estado anterior:
--   - newsletter_self_update USING(true) WITH CHECK(true) — anyone podia
--     atualizar qualquer linha.
--   - push_subscribers_insert_anon WITH CHECK(true) — open insert.
--   - push_subscribers_update_anon USING(true) WITH CHECK(true) — open update.
--
-- Rotas que tocam essas tabelas (subscribeNewsletter, /api/push/subscribe,
-- /api/push/unsubscribe) já usam createAdminClient. Drop direto.
-- =============================================================================

drop policy if exists "newsletter_self_update" on public.newsletter_subscribers;
drop policy if exists "push_subscribers_insert_anon" on public.push_subscribers;
drop policy if exists "push_subscribers_update_anon" on public.push_subscribers;
