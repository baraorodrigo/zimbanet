alter table public.raw_items
  add column if not exists video_url text;
