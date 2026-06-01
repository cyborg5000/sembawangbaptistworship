ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS video_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS video_source text NOT NULL DEFAULT '';

ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_video_status_check,
  DROP CONSTRAINT IF EXISTS songs_video_source_check;

ALTER TABLE public.songs
  ADD CONSTRAINT songs_video_status_check
    CHECK (video_status IN ('none', 'pending', 'approved', 'rejected')),
  ADD CONSTRAINT songs_video_source_check
    CHECK (video_source IN ('', 'cloudinary', 'youtube', 'direct'));

CREATE OR REPLACE FUNCTION public.normalize_song_video()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_url text;
BEGIN
  NEW.video_url := COALESCE(btrim(NEW.video_url), '');

  IF TG_OP = 'INSERT' THEN
    old_url := '';
  ELSE
    old_url := COALESCE(OLD.video_url, '');
  END IF;

  IF NEW.video_url = '' THEN
    NEW.video_status := 'none';
    NEW.video_source := '';
    RETURN NEW;
  END IF;

  IF NEW.video_url ~* '(res\.cloudinary\.com|cloudinary\.com)' THEN
    NEW.video_source := 'cloudinary';
  ELSIF NEW.video_url ~* '(youtube\.com|youtu\.be)' THEN
    NEW.video_source := 'youtube';
  ELSE
    NEW.video_source := 'direct';
  END IF;

  -- Any future newly pasted or replaced video starts hidden until approved.
  -- Existing rows are approved by the backfill below, and approval-only updates
  -- keep their explicit status because the URL did not change.
  IF NEW.video_url IS DISTINCT FROM old_url THEN
    NEW.video_status := 'pending';
  ELSIF NEW.video_status NOT IN ('pending', 'approved', 'rejected') THEN
    NEW.video_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_songs_normalize_video ON public.songs;
CREATE TRIGGER trg_songs_normalize_video
BEFORE INSERT OR UPDATE ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.normalize_song_video();

-- Samuel has already checked the current videos. Keep every existing video live.
UPDATE public.songs
SET
  video_status = CASE WHEN COALESCE(btrim(video_url), '') = '' THEN 'none' ELSE 'approved' END,
  video_source = CASE
    WHEN COALESCE(btrim(video_url), '') = '' THEN ''
    WHEN video_url ~* '(res\.cloudinary\.com|cloudinary\.com)' THEN 'cloudinary'
    WHEN video_url ~* '(youtube\.com|youtu\.be)' THEN 'youtube'
    ELSE 'direct'
  END;
