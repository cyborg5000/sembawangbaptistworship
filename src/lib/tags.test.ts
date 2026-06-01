import { describe, it, expect } from "vitest";
import { normalizeTags, matchesSong, type Song } from "./songs";

const mk = (over: Partial<Song> = {}): Song => ({
  id: "1",
  title: "",
  title_en: "",
  description: "",
  lyrics: "",
  lyrics_en: "",
  pinyin: "",
  score_url: "",
  video_url: "",
  video_status: "none",
  video_source: "",
  tags: [],
  created_at: "",
  updated_at: "",
  ...over,
});

describe("normalizeTags", () => {
  it("trims, lowercases, collapses whitespace", () => {
    expect(normalizeTags(["  Praise  ", "  PRAISE\tTEAM "])).toEqual(["praise", "praise team"]);
  });

  it("removes duplicates while preserving first-seen order", () => {
    expect(normalizeTags(["praise", "Praise", "PRAISE"])).toEqual(["praise"]);
    expect(normalizeTags(["communion", "praise", "communion"])).toEqual(["communion", "praise"]);
  });

  it("drops empty / whitespace-only entries", () => {
    expect(normalizeTags(["", "   ", "praise"])).toEqual(["praise"]);
  });

  it("handles null/undefined gracefully", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags([])).toEqual([]);
  });
});

describe("matchesSong — partial tag matching via haystack", () => {
  it("typing 'praise' matches 'Praise Team' tag", () => {
    const s = mk({ title: "Holy", tags: ["praise team"] });
    expect(matchesSong(s, "praise")).toBe(true);
  });

  it("typing a substring matches inside a multi-word tag", () => {
    const s = mk({ title: "Holy", tags: ["communion sunday"] });
    expect(matchesSong(s, "sunday")).toBe(true);
  });

  it("does not return irrelevant songs", () => {
    const s = mk({ title: "Amazing Grace", tags: ["hymn"] });
    expect(matchesSong(s, "praise")).toBe(false);
  });

  it("tag tokens AND with other tokens (every token must match)", () => {
    const s = mk({ title: "Holy", tags: ["praise"] });
    expect(matchesSong(s, "praise holy")).toBe(true);
    expect(matchesSong(s, "praise missing")).toBe(false);
  });
});

/**
 * Mirrors the filter logic used in the route: chip selection is AND across
 * normalized tag arrays. Keeping the assertion local to this test file
 * documents the contract without coupling to the route component.
 */
function filterByTags(songs: Song[], selected: string[]): Song[] {
  if (selected.length === 0) return songs;
  return songs.filter((s) => {
    const tags = normalizeTags(s.tags);
    return selected.every((t) => tags.includes(t));
  });
}

describe("tag filter bar — AND logic across chips", () => {
  const library = [
    mk({ id: "a", title: "A", tags: ["praise", "sunday"] }),
    mk({ id: "b", title: "B", tags: ["praise", "communion"] }),
    mk({ id: "c", title: "C", tags: ["communion"] }),
    mk({ id: "d", title: "D", tags: ["Praise", "  COMMUNION "] }), // pre-normalized
  ];

  it("single chip narrows the list", () => {
    expect(filterByTags(library, ["praise"]).map((s) => s.id)).toEqual(["a", "b", "d"]);
  });

  it("two chips require BOTH tags on the song (AND)", () => {
    expect(filterByTags(library, ["praise", "communion"]).map((s) => s.id)).toEqual(["b", "d"]);
  });

  it("returns empty when no song matches every selected chip", () => {
    expect(filterByTags(library, ["praise", "sunday", "communion"])).toEqual([]);
  });

  it("empty selection returns the full list", () => {
    expect(filterByTags(library, [])).toHaveLength(library.length);
  });
});
