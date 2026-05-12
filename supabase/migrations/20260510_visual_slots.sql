-- ============================================================
-- ZIMBANET — Slot Studio (Fase B do Estúdio)
-- Adiciona slots estruturados na tabela articles.
-- Substitui o "image_prompt" em texto livre que o agente Visual
-- (radar Python — app/agents/visual.py) produzia hoje, abrindo
-- caminho pro admin editar slots discretos no Estúdio e o Visual
-- agent compilar prompt determinístico via buildPromptFromSlots.
-- ============================================================

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS visual_slots JSONB
    DEFAULT '{}'::jsonb;

COMMENT ON COLUMN articles.visual_slots IS
  'Slots estruturados que alimentam o Visual agent — {subject, scene, framing, mood, style, brand_tone, negative}.';

CREATE INDEX IF NOT EXISTS articles_visual_slots_gin ON articles USING gin (visual_slots);
