-- Importação manual de matérias por URL — coluna direta na articles
-- pra preservar a fonte sem precisar criar raw_items/scored_items fantasmas.
-- O `getArticleSourceUrl` continua olhando scored_items primeiro (pipeline
-- automático), e cai aqui se não tiver vínculo (importação manual).

alter table public.articles
  add column if not exists source_url text;

create index if not exists ix_articles_source_url
  on public.articles(source_url)
  where source_url is not null;
