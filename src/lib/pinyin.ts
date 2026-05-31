import { pinyin } from "pinyin-pro";

/**
 * Hanyu pinyin is generated on the fly from the Chinese text — we do NOT store it.
 * This keeps pinyin consistent with the displayed characters and covers every song
 * (including those imported without a pinyin column).
 */

const CJK = /[一-鿿]/;

/** Convert Chinese text to tone-marked pinyin, preserving line breaks & non-Chinese lines. */
export function toPinyin(text: string): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      if (!CJK.test(line)) return line; // already latin (e.g. English) — leave as-is
      return pinyin(line, { toneType: "symbol", nonZh: "consecutive" });
    })
    .join("\n");
}

// Cache generated pinyin per song id so we only compute each song once.
const cache = new Map<string, string>();

/** Pinyin for a song's lyrics (cached). Honors a stored pinyin value if present. */
export function songPinyin(song: {
  id: string;
  title: string;
  lyrics: string;
  pinyin?: string;
}): string {
  if (song.pinyin && song.pinyin.trim()) return song.pinyin;
  const hit = cache.get(song.id);
  if (hit !== undefined) return hit;
  const generated = toPinyin(song.lyrics || "");
  cache.set(song.id, generated);
  return generated;
}

/** Pinyin of the title only (cheap) — used to make titles pinyin-searchable. */
export function titlePinyin(title: string): string {
  return CJK.test(title) ? pinyin(title, { toneType: "none" }) : "";
}
