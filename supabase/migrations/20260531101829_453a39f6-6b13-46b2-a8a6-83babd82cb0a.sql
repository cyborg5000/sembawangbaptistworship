
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  lyrics TEXT DEFAULT '',
  pinyin TEXT DEFAULT '',
  score_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO anon, authenticated;
GRANT ALL ON public.songs TO service_role;

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view songs" ON public.songs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert songs" ON public.songs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update songs" ON public.songs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete songs" ON public.songs FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX songs_title_idx ON public.songs USING gin (to_tsvector('simple', title));
CREATE INDEX songs_lyrics_idx ON public.songs USING gin (to_tsvector('simple', lyrics));
