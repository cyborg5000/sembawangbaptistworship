CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_songs_title_trgm
  ON public.songs USING GIN (title gin_trgm_ops);