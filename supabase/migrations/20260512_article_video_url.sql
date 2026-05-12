-- Matéria pode ter vídeo embedado (YouTube/Instagram/TikTok). URL externa,
-- o player renderiza via iframe no template — sem upload nem storage.
-- Provider é detectado em runtime pela URL (não precisa coluna separada).

alter table public.articles
  add column if not exists video_url text;
