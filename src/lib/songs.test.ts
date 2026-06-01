import { describe, it, expect } from "vitest";
import {
  foldPinyin,
  normalize,
  normalizeKeepSpaces,
  tokenizeQuery,
  matchesSong,
  approvedVideoUrl,
  type Song,
} from "./songs";

const song = (over: Partial<Song> = {}): Song => ({
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

describe("foldPinyin", () => {
  it("strips tone-number suffixes", () => {
    expect(foldPinyin("ni3hao3")).toBe("nihao");
    expect(foldPinyin("ni3 hao3")).toBe("ni hao");
    expect(foldPinyin("wo3men5")).toBe("women");
  });

  it("leaves digits outside the 1-5 tone range alone", () => {
    expect(foldPinyin("psalm96")).toBe("psalm96");
    expect(foldPinyin("year2026")).toBe("year2026");
  });

  it("maps v → u for ü variants", () => {
    expect(foldPinyin("lv")).toBe("lu");
    expect(foldPinyin("nv3")).toBe("nu");
    expect(foldPinyin("lve4")).toBe("lue");
  });
});

describe("normalize", () => {
  it("strips diacritics on tone-marked pinyin", () => {
    expect(normalize("Nǐ Hǎo")).toBe("nihao");
    expect(normalize("yē sū")).toBe("yesu");
  });

  it("matches tone-number form against tone-mark form", () => {
    expect(normalize("ni3 hao3")).toBe(normalize("Nǐ Hǎo"));
    expect(normalize("ye1 su1")).toBe(normalize("yē sū"));
  });

  it("treats ü and v as equivalent", () => {
    expect(normalize("lǚ xíng")).toBe(normalize("lv xing"));
    expect(normalize("nǚ")).toBe(normalize("nv"));
  });

  it("drops punctuation and whitespace", () => {
    expect(normalize("Ye-Su, Ai Wo!")).toBe("yesuaiwo");
  });

  it("preserves CJK", () => {
    expect(normalize("耶稣爱我")).toBe("耶稣爱我");
  });
});

describe("normalizeKeepSpaces", () => {
  it("collapses punctuation to single spaces", () => {
    expect(normalizeKeepSpaces("Ye-Su,  Ai  Wo!")).toBe("ye su ai wo");
  });

  it("folds tone numbers while keeping word boundaries", () => {
    expect(normalizeKeepSpaces("ni3 hao3 ma5")).toBe("ni hao ma");
  });
});

describe("tokenizeQuery", () => {
  it("splits latin runs and individual CJK chars", () => {
    expect(tokenizeQuery("ye su 耶稣")).toEqual(["ye", "su", "耶", "稣"]);
  });

  it("returns empty for blank input", () => {
    expect(tokenizeQuery("   ")).toEqual([]);
  });

  it("folds tone numbers in tokens", () => {
    expect(tokenizeQuery("ni3 hao3")).toEqual(["ni", "hao"]);
  });
});

describe("matchesSong", () => {
  const s = song({
    title: "耶稣爱我",
    pinyin: "Yē sū ài wǒ",
    lyrics: "耶稣爱我我知道",
  });

  it("matches tone-numbered query against tone-marked pinyin", () => {
    expect(matchesSong(s, "ye1 su1")).toBe(true);
    expect(matchesSong(s, "ai3 wo3")).toBe(true);
  });

  it("matches partial pinyin without spaces", () => {
    expect(matchesSong(s, "yesu")).toBe(true);
  });

  it("matches v/ü variant queries", () => {
    const lv = song({ title: "旅行", pinyin: "Lǚ xíng" });
    expect(matchesSong(lv, "lv xing")).toBe(true);
    expect(matchesSong(lv, "lu xing")).toBe(true);
  });

  it("returns false when any token is missing", () => {
    expect(matchesSong(s, "ye su foo")).toBe(false);
  });

  it("empty query matches anything", () => {
    expect(matchesSong(s, "")).toBe(true);
  });
});

describe("approvedVideoUrl", () => {
  it("only exposes approved videos", () => {
    expect(
      approvedVideoUrl(
        song({ video_url: "https://youtu.be/abcdefghijk", video_status: "pending" }),
      ),
    ).toBe("");
    expect(
      approvedVideoUrl(
        song({ video_url: "https://youtu.be/abcdefghijk", video_status: "approved" }),
      ),
    ).toBe("https://youtu.be/abcdefghijk");
  });
});
