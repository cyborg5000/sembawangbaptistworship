import { supabase } from "@/integrations/supabase/client";

// Supabase types regenerate after migrations propagate; cast to keep
// the build green meanwhile.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type Song = {
  id: string;
  title: string;
  description: string;
  lyrics: string;
  pinyin: string;
  score_url: string;
  video_url: string;
  created_at: string;
  updated_at: string;
};

export type SongInput = Omit<Song, "id" | "created_at" | "updated_at">;

export async function fetchSongs(): Promise<Song[]> {
  const { data, error } = await db
    .from("songs")
    .select("*")
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Song[];
}

export async function createSong(input: SongInput): Promise<Song> {
  const { data, error } = await db
    .from("songs")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Song;
}

export async function updateSong(id: string, input: Partial<SongInput>): Promise<Song> {
  const { data, error } = await db
    .from("songs")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Song;
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await db.from("songs").delete().eq("id", id);
  if (error) throw error;
}

/** Normalize for matching: lowercase, strip diacritics & punctuation/spaces */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

export function matchesSong(song: Song, query: string): boolean {
  if (!query.trim()) return true;
  const q = normalize(query);
  if (!q) return true;
  const haystack = normalize(
    `${song.title} ${song.description} ${song.lyrics} ${song.pinyin}`,
  );
  return haystack.includes(q);
}

/** Returns YouTube embed URL if input is a YouTube link, else null */
export function youtubeEmbed(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}