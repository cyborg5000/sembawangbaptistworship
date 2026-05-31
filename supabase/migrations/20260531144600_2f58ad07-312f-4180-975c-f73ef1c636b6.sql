ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_songs_tags ON public.songs USING GIN (tags);