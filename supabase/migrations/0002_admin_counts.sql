-- Funções agregadas pra cortar N round-trips de count no admin.

-- Dashboard: todas as contagens numa chamada só.
create or replace function admin_dashboard_counts()
returns json language sql stable as $$
  select json_build_object(
    'draft',             (select count(*) from articles where status='draft'),
    'review',            (select count(*) from articles where status='review'),
    'published',         (select count(*) from articles where status='published'),
    'rejected',          (select count(*) from articles where status='rejected'),
    'sources',           (select count(*) from sources where active),
    'socialPending',     (select count(*) from social_posts where status='pending'),
    'rawUnscored',       (select count(*) from raw_items where is_duplicate=false),
    'scoredApproved',    (select count(*) from scored_items where status='scored' and decision='approve'),
    'enrichedNoArticle', (select count(*) from enriched_items)
  )
$$;

-- Fontes: itens coletados por fonte.
create or replace function raw_counts_by_source()
returns table(source_id text, n bigint) language sql stable as $$
  select source_id, count(*)::bigint from raw_items group by source_id
$$;

-- Personas: matérias por persona.
create or replace function article_counts_by_persona()
returns table(persona_id uuid, n bigint) language sql stable as $$
  select persona_id, count(*)::bigint from articles where persona_id is not null group by persona_id
$$;
