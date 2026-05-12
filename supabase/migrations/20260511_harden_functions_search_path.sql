-- =============================================================================
-- Harden de funções: search_path + revoke RPC público
-- =============================================================================
-- Aplicado via MCP em 2026-05-11. Documenta em arquivo pra rastreio.
--
-- Advisor flagou:
--   - is_admin, tg_curator_rubric_updated_at, mural_*_count_sync com
--     search_path mutável (CVE-style injection se search_path do caller mudar)
--   - mural_*_count_sync como SECURITY DEFINER expostas via /rest/v1/rpc
--     (deveriam só rodar via trigger interno)
-- =============================================================================

alter function public.is_admin() set search_path = public;
alter function public.mural_likes_count_sync() set search_path = public;
alter function public.mural_comments_count_sync() set search_path = public;
alter function public.tg_curator_rubric_updated_at() set search_path = public;

revoke execute on function public.mural_likes_count_sync() from anon, authenticated, public;
revoke execute on function public.mural_comments_count_sync() from anon, authenticated, public;
