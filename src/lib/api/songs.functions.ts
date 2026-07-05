// Neon-backed song data access as TanStack Start server functions. Reads are
// public; writes require an admin session. Replaces the old browser Supabase
// calls. Server-only imports (db, auth) are tree-shaken from the client bundle.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import type { Song, SongInput, VideoStatus } from "@/lib/songs";
import { normalizeTags, normalizeVideoPayload } from "@/lib/songs";

const SONG_COLUMNS =
  "id, title, title_en, description, lyrics, lyrics_en, pinyin, score_url, video_url, video_status, video_source, tags, created_at, updated_at";

function rowToSong(r: Record<string, unknown>): Song {
  return {
    id: String(r.id),
    title: (r.title as string) ?? "",
    title_en: (r.title_en as string) ?? "",
    description: (r.description as string) ?? "",
    lyrics: (r.lyrics as string) ?? "",
    lyrics_en: (r.lyrics_en as string) ?? "",
    pinyin: (r.pinyin as string) ?? "",
    score_url: (r.score_url as string) ?? "",
    video_url: (r.video_url as string) ?? "",
    video_status: ((r.video_status as VideoStatus) ?? "none"),
    video_source: ((r.video_source as Song["video_source"]) ?? ""),
    tags: (r.tags as string[]) ?? [],
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

const songInputSchema = z.object({
  title: z.string().min(1),
  title_en: z.string().default(""),
  description: z.string().default(""),
  lyrics: z.string().default(""),
  lyrics_en: z.string().default(""),
  pinyin: z.string().default(""),
  score_url: z.string().default(""),
  video_url: z.string().default(""),
  video_status: z.enum(["none", "pending", "approved", "rejected"]).default("none"),
  video_source: z.enum(["", "cloudinary", "youtube", "direct"]).default(""),
  tags: z.array(z.string()).default([]),
});

async function assertAdmin() {
  const { requireAdmin } = await import("@/server/auth");
  await requireAdmin(getRequest());
}

export const listSongs = createServerFn({ method: "GET" }).handler(async (): Promise<Song[]> => {
  const { getSql } = await import("@/lib/db.server");
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(SONG_COLUMNS)} from public.songs order by title asc`;
  return (rows as unknown as Record<string, unknown>[]).map(rowToSong);
});

export const createSongFn = createServerFn({ method: "POST" })
  .inputValidator(songInputSchema)
  .handler(async ({ data }): Promise<Song> => {
    await assertAdmin();
    const { getSql } = await import("@/lib/db.server");
    const sql = getSql();
    const payload = {
      title: data.title,
      title_en: data.title_en,
      description: data.description,
      lyrics: data.lyrics,
      lyrics_en: data.lyrics_en,
      pinyin: data.pinyin,
      score_url: data.score_url,
      tags: normalizeTags(data.tags),
      ...normalizeVideoPayload(data.video_url, data.video_status),
    };
    const rows = await sql`insert into public.songs ${sql(payload)} returning ${sql.unsafe(SONG_COLUMNS)}`;
    return rowToSong(rows[0] as Record<string, unknown>);
  });

export const updateSongFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), input: songInputSchema.partial() }))
  .handler(async ({ data }): Promise<Song> => {
    await assertAdmin();
    const { getSql } = await import("@/lib/db.server");
    const sql = getSql();
    const input = data.input;
    const payload: Record<string, unknown> = {};
    for (const k of ["title", "title_en", "description", "lyrics", "lyrics_en", "pinyin", "score_url"] as const) {
      if (input[k] !== undefined) payload[k] = input[k];
    }
    if (input.tags !== undefined) payload.tags = normalizeTags(input.tags);
    if (input.video_url !== undefined) {
      Object.assign(payload, normalizeVideoPayload(input.video_url, input.video_status as VideoStatus | undefined));
    }
    payload.updated_at = new Date();
    const rows = await sql`update public.songs set ${sql(payload)} where id = ${data.id} returning ${sql.unsafe(SONG_COLUMNS)}`;
    if (!rows[0]) throw new Error("Song not found");
    return rowToSong(rows[0] as Record<string, unknown>);
  });

export const setVideoCandidateFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), url: z.string() }))
  .handler(async ({ data }): Promise<Song> => {
    await assertAdmin();
    const payload = normalizeVideoPayload(data.url, "pending");
    if (payload.video_source !== "youtube") throw new Error("Only YouTube links can be queued for approval.");
    const { getSql } = await import("@/lib/db.server");
    const sql = getSql();
    const rows = await sql`update public.songs set ${sql({ ...payload, video_status: "pending", updated_at: new Date() })} where id = ${data.id} returning ${sql.unsafe(SONG_COLUMNS)}`;
    if (!rows[0]) throw new Error("Song not found");
    return rowToSong(rows[0] as Record<string, unknown>);
  });

export const setVideoStatusFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }))
  .handler(async ({ data }): Promise<Song> => {
    await assertAdmin();
    const { getSql } = await import("@/lib/db.server");
    const sql = getSql();
    const rows = await sql`update public.songs set ${sql({ video_status: data.status, updated_at: new Date() })} where id = ${data.id} returning ${sql.unsafe(SONG_COLUMNS)}`;
    if (!rows[0]) throw new Error("Song not found");
    return rowToSong(rows[0] as Record<string, unknown>);
  });

export const deleteSongFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await assertAdmin();
    const { getSql } = await import("@/lib/db.server");
    const sql = getSql();
    await sql`delete from public.songs where id = ${data.id}`;
    return { ok: true };
  });
