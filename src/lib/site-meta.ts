const rawSiteUrl = import.meta.env.VITE_SITE_URL ?? "";

export const SITE_NAME = "SBC Worship Songs";
export const SITE_TITLE = "诗歌库 · Sembawang Baptist Church Worship Songs";
export const SITE_DESCRIPTION =
  "Search Chinese and English worship songs by title, lyrics, tags, or hanyu pinyin for Sembawang Baptist Church 森峇旺浸信教会.";

export function siteAsset(path: `/${string}`): string {
  const siteUrl = rawSiteUrl.trim().replace(/\/$/, "");
  return siteUrl ? `${siteUrl}${path}` : path;
}
