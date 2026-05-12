-- =============================================================================
-- Guest INSERT policies pro mural e bazar (pré-deploy)
-- =============================================================================
-- As policies atuais (mural_insert_authenticated, bazar_insert_authenticated)
-- só liberam INSERT pro role `authenticated` com auth.uid() = user_id. Isso
-- BLOQUEIA o fluxo guest descrito em src/lib/actions/community.ts:
--   - guest insere com user_id NULL + pending_email + status='pending_confirmation'
--   - magic link confirma o email → trigger claim_pending_community_content
--     atualiza user_id e status pra 'published'/'active'
--
-- Esta migration adiciona INSERT policies dedicadas ao role `anon` com
-- guard rails: status pendente + pending_email obrigatório + user_id NULL.
-- =============================================================================

-- MURAL
drop policy if exists "mural_insert_guest" on public.mural_posts;
create policy "mural_insert_guest"
  on public.mural_posts for insert
  to anon
  with check (
    user_id is null
    and pending_email is not null
    and status = 'pending_confirmation'
  );

-- BAZAR
drop policy if exists "bazar_insert_guest" on public.bazar_items;
create policy "bazar_insert_guest"
  on public.bazar_items for insert
  to anon
  with check (
    user_id is null
    and pending_email is not null
    and status = 'pending_confirmation'
  );
