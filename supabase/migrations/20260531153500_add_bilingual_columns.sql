-- Bilingual support: English title + English lyrics, so the app can show a
-- 中文 / English tab per song. (Samuel 2026-05-31)
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS title_en  text NOT NULL DEFAULT '';
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics_en text NOT NULL DEFAULT '';

-- include English fields in full-text search
CREATE INDEX IF NOT EXISTS songs_title_en_idx  ON public.songs USING gin (to_tsvector('simple', title_en));
CREATE INDEX IF NOT EXISTS songs_lyrics_en_idx ON public.songs USING gin (to_tsvector('simple', lyrics_en));
