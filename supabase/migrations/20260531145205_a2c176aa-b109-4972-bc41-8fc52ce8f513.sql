-- Maintained text representation of tags for trigram search.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS tags_text text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.normalize_song_tags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cleaned text[];
BEGIN
  IF NEW.tags IS NULL THEN
    cleaned := ARRAY[]::text[];
  ELSE
    WITH src AS (
      SELECT DISTINCT
        NULLIF(regexp_replace(lower(btrim(t)), '\s+', ' ', 'g'), '') AS t
      FROM unnest(NEW.tags) AS u(t)
    )
    SELECT COALESCE(array_agg(t ORDER BY t), ARRAY[]::text[])
    INTO cleaned
    FROM src
    WHERE t IS NOT NULL;
  END IF;
  NEW.tags := cleaned;
  NEW.tags_text := array_to_string(cleaned, ' ');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_songs_normalize_tags ON public.songs;
CREATE TRIGGER trg_songs_normalize_tags
BEFORE INSERT OR UPDATE ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.normalize_song_tags();

-- Backfill existing rows through the trigger.
UPDATE public.songs SET tags = tags;

-- Trigram index for fast partial tag matching.
CREATE INDEX IF NOT EXISTS idx_songs_tags_text_trgm
  ON public.songs USING GIN (tags_text gin_trgm_ops);