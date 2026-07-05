import { songPinyin, titlePinyin } from "@/lib/pinyin";
import {
  listSongs,
  createSongFn,
  updateSongFn,
  setVideoCandidateFn,
  setVideoStatusFn,
  deleteSongFn,
} from "@/lib/api/songs.functions";

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
  video_status: VideoStatus;
  video_source: VideoSource;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type SongInput = Omit<Song, "id" | "created_at" | "updated_at">;
export type VideoStatus = "none" | "pending" | "approved" | "rejected";
export type VideoSource = "" | "cloudinary" | "youtube" | "direct";

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
  return await listSongs();
}

/**
 * Search over the loaded library. Tag chips use AND-containment; the text
 * query uses `matchesSong` (tone-folded pinyin + CJK aware). Runs on the
 * client over the full list returned by `fetchSongs`.
 */
export async function searchSongs(opts: { query?: string; tags?: string[] }): Promise<Song[]> {
  const q = (opts.query ?? "").trim();
  const tags = normalizeTags(opts.tags);
  const all = await fetchSongs();
  return all.filter((song) => {
    if (tags.length > 0) {
      const songTags = new Set(normalizeTags(song.tags));
      if (!tags.every((t) => songTags.has(t))) return false;
    }
    if (q && !matchesSong(song, q)) return false;
    return true;
  });
}

export async function createSong(input: SongInput): Promise<Song> {
  return await createSongFn({ data: input });
}

export async function updateSong(id: string, input: Partial<SongInput>): Promise<Song> {
  return await updateSongFn({ data: { id, input } });
}

export async function setSongVideoCandidate(id: string, url: string): Promise<Song> {
  return await setVideoCandidateFn({ data: { id, url } });
}

export async function setSongVideoStatus(
  id: string,
  status: Extract<VideoStatus, "approved" | "rejected">,
): Promise<Song> {
  return await setVideoStatusFn({ data: { id, status } });
}

export async function deleteSong(id: string): Promise<void> {
  await deleteSongFn({ data: { id } });
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

export function detectVideoSource(url: string): VideoSource {
  const clean = url.trim();
  if (!clean) return "";
  if (/res\.cloudinary\.com|cloudinary\.com/i.test(clean)) return "cloudinary";
  if (youtubeEmbed(clean)) return "youtube";
  return "direct";
}

export function approvedVideoUrl(
  song: Pick<Song, "video_url"> & { video_status?: VideoStatus },
): string {
  if (
    (song.video_status === "approved" || song.video_status === undefined) &&
    song.video_url?.trim()
  ) {
    return song.video_url.trim();
  }
  return "";
}

export function normalizeVideoPayload(
  url: string | null | undefined,
  status?: VideoStatus,
): { video_url: string; video_status: VideoStatus; video_source: VideoSource } {
  const clean = (url ?? "").trim();
  const source = detectVideoSource(clean);
  if (!clean) {
    return { video_url: "", video_status: "none", video_source: "" };
  }
  const effectiveStatus = status && status !== "none" ? status : "pending";
  return {
    video_url: clean,
    video_status: effectiveStatus,
    video_source: source,
  };
}
