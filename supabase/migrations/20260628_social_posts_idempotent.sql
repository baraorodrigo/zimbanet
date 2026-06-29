-- Fase 4 — social_posts idempotente: no máximo 1 linha por (article_id, channel).
--
-- Antes desta migration o distribuidor (radar/app/agents/distribuidor.py) fazia
-- INSERT puro; re-rodar (finalize/redistribuir) ou um retry duplicava o post
-- social. Aqui: (1) deduplica o que já existe, preservando a linha mais avançada
-- (enviada/agendada > pending) e mais recente; (2) cria a constraint UNIQUE que
-- torna a escrita idempotente (defesa-em-profundidade — o código já passa a
-- apagar pendentes e pular enviados, mas a constraint pega qualquer bug futuro).
-- Idempotente / re-rodável.

-- 1) Dedup: mantém 1 por (article_id, channel), apaga as sobras.
--    Prioridade de quem MANTER (mais "vivo/finalizado" primeiro): published >
--    scheduled > ready (curado) > generating > pending > failed (descartado, por
--    último — um vivo sempre ganha de um dispensado); empate, o mais recente.
with ranked as (
  select
    id,
    row_number() over (
      partition by article_id, channel
      order by
        case status
          when 'published'  then 0
          when 'scheduled'  then 1
          when 'ready'      then 2
          when 'generating' then 3
          when 'pending'    then 4
          when 'failed'     then 5
          else 6
        end,
        created_at desc
    ) as rn
  from public.social_posts
)
delete from public.social_posts p
using ranked r
where p.id = r.id
  and r.rn > 1;

-- 2) Constraint UNIQUE (guard pra ser re-rodável — Postgres não tem
--    ADD CONSTRAINT IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_article_channel_uniq'
  ) then
    alter table public.social_posts
      add constraint social_posts_article_channel_uniq
      unique (article_id, channel);
  end if;
end $$;
