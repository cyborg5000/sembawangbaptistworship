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

/** Fold pinyin: strip tone-number suffixes (ni3 → ni) and map v → u (lv → lu). */
export function foldPinyin(s: string): string {
  // Drop tone digits 1-5 that follow a latin letter run: "ni3hao3" → "nihao".
  return s.replace(/([a-z])([1-5])(?=$|[^a-z0-9]|[a-z])/g, "$1").replace(/v/g, "u");
}

/** Normalize for matching: lowercase, strip diacritics, fold pinyin, drop punctuation/spaces */
export function normalize(s: string): string {
  const base = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return foldPinyin(base).replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

/** Normalize but keep spaces as token separators (for partial-token matching). */
export function normalizeKeepSpaces(s: string): string {
  const base = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return foldPinyin(base)
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a query into tokens (CJK chars become individual tokens). */
export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeKeepSpaces(query);
  if (!normalized) return [];
  const tokens: string[] = [];
  for (const chunk of normalized.split(" ")) {
    if (!chunk) continue;
    // Split CJK runs into individual characters; keep latin runs whole.
    const parts = chunk.match(/[\u4e00-\u9fff]|[a-z0-9]+/g);
    if (parts) tokens.push(...parts);
  }
  return tokens;
}

export function matchesSong(song: Song, query: string): boolean {
  if (!query.trim()) return true;
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;
  const haystack = normalize(
    `${song.title} ${song.description} ${song.lyrics} ${song.pinyin}`,
  );
  // Every token must appear somewhere — supports partial pinyin like "ye su ai".
  return tokens.every((t) => haystack.includes(t));
}

/** Returns YouTube embed URL if input is a YouTube link, else null */
export function youtubeEmbed(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}