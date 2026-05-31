import { supabase } from "@/integrations/supabase/client";
import { songPinyin, titlePinyin } from "@/lib/pinyin";

// Supabase types regenerate after migrations propagate; cast to keep
// the build green meanwhile.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type Song = {
  id: string;
  title: string;
  title_en: string;
  description: string;
  lyrics: string;
  lyrics_en: string;
  pinyin: string;
  score_url: string;
  video_url: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type SongInput = Omit<Song, "id" | "created_at" | "updated_at">;

/** Normalize a list of tags: trim, lowercase, drop empties, dedupe (stable order). */
export function normalizeTags(tags: readonly string[] | null | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export async function fetchSongs(): Promise<Song[]> {
  // PostgREST caps each response at ~1000 rows. Page through with .range()
  // until a short batch comes back, so the whole library always loads.
  const PAGE = 1000;
  const all: Song[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("songs")
      .select("*")
      .order("title", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as Song[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

/** Escape PostgREST ILIKE pattern wildcards in a user-supplied query. */
function escapeIlike(s: string): string {
  return s.replace(/[\\%_,]/g, (c) => "\\" + c);
}

/**
 * Server-side search. Tag filters use the GIN index on `tags`; partial
 * text matches use the trigram index on `tags_text`/`title`. Client code
 * may still apply `matchesSong` afterwards for pinyin/CJK nuance.
 */
export async function searchSongs(opts: {
  query?: string;
  tags?: string[];
}): Promise<Song[]> {
  const q = (opts.query ?? "").trim();
  const tags = normalizeTags(opts.tags);
  let req = db.from("songs").select("*").order("title", { ascending: true });

  // Exact-tag chip filter — AND semantics via array containment (GIN-backed).
  if (tags.length > 0) req = req.contains("tags", tags);

  // ASCII queries → push partial-text matching to the database (trigram).
  // Non-ASCII (CJK / accented pinyin) falls through to client matchesSong,
  // which understands tone-folding and ü/v variants.
  if (q && /^[\x20-\x7e]+$/.test(q)) {
    const like = `*${escapeIlike(q)}*`;
    req = req.or(
      [
        `tags_text.ilike.${like}`,
        `title.ilike.${like}`,
        `title_en.ilike.${like}`,
        `lyrics_en.ilike.${like}`,
        `description.ilike.${like}`,
      ].join(","),
    );
  }

  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []) as Song[];
}

export async function createSong(input: SongInput): Promise<Song> {
  const payload = { ...input, tags: normalizeTags(input.tags) };
  const { data, error } = await db
    .from("songs")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Song;
}

export async function updateSong(id: string, input: Partial<SongInput>): Promise<Song> {
  const payload: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  if (input.tags !== undefined) payload.tags = normalizeTags(input.tags);
  const { data, error } = await db
    .from("songs")
    .update(payload)
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
  // Pinyin is generated on the fly (cached) so titles/lyrics are searchable by pinyin
  // without storing it. Falls back to any stored pinyin value inside songPinyin().
  const py = `${titlePinyin(song.title)} ${songPinyin(song)}`;
  const haystack = normalize(
    `${song.title} ${song.title_en ?? ""} ${song.description} ${song.lyrics} ${song.lyrics_en ?? ""} ${py} ${(song.tags ?? []).join(" ")}`,
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