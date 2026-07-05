-- Neon schema for the SBC worship app (ported from Supabase, RLS dropped —
-- access is via server functions using the owner role). 2026-07-05.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram indexes

-- ---------- songs ----------
CREATE TABLE IF NOT EXISTS public.songs (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  lyrics       TEXT NOT NULL DEFAULT '',
  pinyin       TEXT NOT NULL DEFAULT '',
  score_url    TEXT NOT NULL DEFAULT '',
  video_url    TEXT NOT NULL DEFAULT '',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  tags_text    TEXT NOT NULL DEFAULT '',
  title_en     TEXT NOT NULL DEFAULT '',
  lyrics_en    TEXT NOT NULL DEFAULT '',
  video_status TEXT NOT NULL DEFAULT 'none',
  video_source TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.songs DROP CONSTRAINT IF EXISTS songs_video_status_check;
ALTER TABLE public.songs DROP CONSTRAINT IF EXISTS songs_video_source_check;
ALTER TABLE public.songs
  ADD CONSTRAINT songs_video_status_check CHECK (video_status IN ('none','pending','approved','rejected')),
  ADD CONSTRAINT songs_video_source_check CHECK (video_source IN ('','cloudinary','youtube','direct'));

CREATE INDEX IF NOT EXISTS songs_title_idx      ON public.songs USING gin (to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS songs_lyrics_idx     ON public.songs USING gin (to_tsvector('simple', lyrics));
CREATE INDEX IF NOT EXISTS songs_title_en_idx   ON public.songs USING gin (to_tsvector('simple', title_en));
CREATE INDEX IF NOT EXISTS songs_lyrics_en_idx  ON public.songs USING gin (to_tsvector('simple', lyrics_en));
CREATE INDEX IF NOT EXISTS idx_songs_tags       ON public.songs USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_songs_tags_text_trgm ON public.songs USING gin (tags_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_songs_title_trgm ON public.songs USING gin (title gin_trgm_ops);

-- normalize tags -> tags_text on write
CREATE OR REPLACE FUNCTION public.normalize_song_tags() RETURNS trigger AS $$
DECLARE cleaned text[];
BEGIN
  IF NEW.tags IS NULL THEN
    cleaned := ARRAY[]::text[];
  ELSE
    SELECT COALESCE(array_agg(t ORDER BY t), ARRAY[]::text[])
      INTO cleaned
      FROM (SELECT DISTINCT btrim(u.t) AS t FROM unnest(NEW.tags) AS u(t) WHERE btrim(u.t) <> '') s(t);
  END IF;
  NEW.tags := cleaned;
  NEW.tags_text := array_to_string(cleaned, ' ');
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_songs_normalize_tags ON public.songs;
CREATE TRIGGER trg_songs_normalize_tags
  BEFORE INSERT OR UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.normalize_song_tags();

-- ---------- auth_users (Sam Stack) ----------
CREATE TABLE IF NOT EXISTS public.auth_users (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'admin',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
