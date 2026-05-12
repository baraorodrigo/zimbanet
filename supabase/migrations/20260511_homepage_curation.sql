-- Curadoria manual da home: editor escolhe a capa e os destaques.
-- Sem unicidade no nível do banco — uniqueness da capa é garantida na
-- Server Action (unset dos outros quando marca um novo). Mais flexível
-- pra casos de transição (ex.: arquivar uma matéria que era capa sem
-- precisar de migration).

alter table public.articles
  add column if not exists is_cover boolean not null default false,
  add column if not exists is_highlight boolean not null default false;

-- Índices parciais — só linhas marcadas. Mantém custo zero quando nada
-- foi curado, mas acelera o lookup da home.
create index if not exists articles_is_cover_idx
  on public.articles (published_at desc)
  where is_cover = true and status = 'published';

create index if not exists articles_is_highlight_idx
  on public.articles (published_at desc)
  where is_highlight = true and status = 'published';
