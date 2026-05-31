import Fuse from "fuse.js";
import { pinyin } from "pinyin-pro";
import type { Song } from "@/lib/songs";

/**
 * Smart song search: typo-tolerant, ranked, multi-field.
 *
 * Strong matches (exact title / clear pinyin) rank at the top; looser fuzzy
 * matches fall below. Searchable by Chinese title, English title, hanyu pinyin
 * (toneless, so "ye su" finds 耶稣), theme/feeling tags, description, and lyrics
 * in both languages — generated pinyin is built into the index so nothing needs
 * to be stored.
 */

export type IndexedSong = Song & {
  _titlePinyin: string; // toneless pinyin of the Chinese title
  _pinyin: string; // toneless pinyin of the lyrics (for pinyin lyric search)
};

const CJK = /[一-鿿]/;
const tonelessCache = new Map<string, string>();

function toneless(text: string, id: string): string {
  const hit = tonelessCache.get(id);
  if (hit !== undefined) return hit;
  const out = CJK.test(text)
    ? pinyin(text, { toneType: "none", nonZh: "consecutive" })
    : "";
  tonelessCache.set(id, out);
  return out;
}

/** Build a ranked fuzzy index over all songs (memoize on the song list). */
export function buildSongIndex(songs: Song[]): Fuse<IndexedSong> {
  const indexed: IndexedSong[] = songs.map((s) => ({
    ...s,
    _titlePinyin: CJK.test(s.title)
      ? pinyin(s.title, { toneType: "none" })
      : "",
    // Lyrics pinyin can be large; cache per-song id.
    _pinyin: toneless(s.lyrics || "", "ly:" + s.id),
  }));

  return new Fuse(indexed, {
    includeScore: true,
    threshold: 0.38, // typo tolerance: 0 = exact, 1 = match anything
    ignoreLocation: true, // match anywhere in the field, not just the start
    minMatchCharLength: 1,
    useExtendedSearch: false,
    keys: [
      { name: "title", weight: 3.0 },
      { name: "title_en", weight: 3.0 },
      { name: "_titlePinyin", weight: 2.5 },
      { name: "tags", weight: 2.0 },
      { name: "description", weight: 1.3 },
      { name: "_pinyin", weight: 1.0 },
      { name: "lyrics_en", weight: 0.8 },
      { name: "lyrics", weight: 0.8 },
    ],
  });
}

/** Run a ranked search. Returns songs best-match-first. */
export function searchRanked(fuse: Fuse<IndexedSong>, query: string): Song[] {
  const q = query.trim();
  if (!q) return [];
  return fuse.search(q).map((r) => r.item as Song);
}
