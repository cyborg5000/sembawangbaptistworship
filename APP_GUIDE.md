# SBC Worship Song App — Reference Guide

The Sembawang Baptist Church worship song-picker. Search the church's Chinese-Christian
song library, see lyrics (中文/English), hanyu pinyin, scores, and videos; manage everything
from an admin table. This doc is the single reference for future work sessions.

---

## 1. What it is
- **Repo:** `github.com/cyborg5000/sembawangbaptistworship` (GitHub display "Samuel").
- **Local checkout:** `/Users/chanfamilysg.ai/Documents/GitHub/Samuel/sembawangbaptistworship` — **use this, don't re-clone.**
- **Stack:** Lovable + TanStack Start (React) + Supabase + shadcn/ui + Tailwind, package manager **bun**.
- **Deploy:** Lovable builds from GitHub `main`. To go live: push to `main`, then click **Publish** in Lovable. (NOT a Vercel project.)

## 2. Run / build / test (from the repo dir)
```bash
bun install         # first time
bun run dev         # local dev → http://localhost:8080
bun run build       # production build (also catches type errors)
bun run test        # vitest unit tests (48 tests)
```

## 3. Routes
- `/` — public song library: ranked fuzzy search, content filters, favourites, song detail sheet. **Browse-only** (no editing).
- `/admin` — Supabase-auth login + management table (search, add, edit, delete), 20/page.

## 4. Data model — Supabase `songs` table
`id, title, title_en, description, lyrics, lyrics_en, pinyin, score_url, video_url, tags[] (+ tags_text), created_at, updated_at`
- **title/lyrics** = Chinese (Simplified). **title_en/lyrics_en** = English — **only real, printed English** (never machine-translated; empty if none).
- **pinyin** column is unused — hanyu pinyin is **generated on the fly** (`pinyin-pro`), never stored.
- **score_url** may hold **multiple newline-separated URLs** (multi-page scores).
- **video_url** = a Cloudinary mp4 (or a YouTube link — `youtubeEmbed()` handles both).
- No `audio_url` column yet (see Follow-ups).

## 5. Key source files
- `src/lib/songs.ts` — data layer: `fetchSongs` (pages past the 1000-row cap), `createSong/updateSong/deleteSong`, tag normalize, `matchesSong`.
- `src/lib/search.ts` — **Fuse.js** ranked fuzzy search; weighted keys (title/pinyin/tags/lyrics), typo-tolerant, results sorted best-first.
- `src/lib/pinyin.ts` — generates hanyu pinyin (`toPinyin`, `songPinyin`, `linePinyin`, `titlePinyin`); cached.
- `src/components/SongSheet.tsx` — song detail: 中文/English tab, **拼音 toggle** (interlinear pinyin under each line), score (multi-page), video, stanza-lock.
- `src/components/SongFormDialog.tsx` — add/edit form (CN + EN fields; no pinyin field — auto-generated).
- `src/components/Pager.tsx` — shared pagination control. Public = 100/page, admin = 20/page.
- `src/routes/admin.tsx` + `src/hooks/use-auth.ts` — admin login + table.
- `src/integrations/supabase/client.ts` / `types.ts` — Supabase client + generated types.

## 6. Env & secrets
- `.env` (TRACKED/pushed) — Supabase publishable keys + **public** Cloudinary `VITE_CLOUDINARY_CLOUD_NAME=dvlhuloa0`, `VITE_CLOUDINARY_UPLOAD_PRESET=sembawangbaptistworship`.
- `.env.local` (GITIGNORED) — the **secret** `CLOUDINARY_URL=cloudinary://<key>:<secret>@dvlhuloa0`. Never commit this.
- Supabase project ref: `bpdifamrojoqloifcleh` (**Lovable-managed account** — NOT under Samuel's CLI/MCP, so `supabase link` fails). The **anon key can read + write** (RLS is currently open).

## 7. Schema migrations
DDL must be applied by Samuel — the project isn't reachable via CLI/MCP. Options:
1. Paste SQL in the **Supabase SQL editor**, or
2. Add a file under `supabase/migrations/` and apply via Lovable.
(The anon key can INSERT/UPDATE/DELETE rows via REST, but cannot run DDL.)

## 8. Cloudinary
- Account `dvlhuloa0`, **Plus plan** (225 credits/mo), shared with Samuel's other projects.
- Worship media lives under the **`sembawangbaptistworship/`** folder: `scores/`, `videos/`, `audio/`.
- Video max file size: 2 GB. 1 credit ≈ 1 GB storage or 1 GB delivery or 1000 transforms.

## 9. Source data + the import pipeline
Lyric source + media + build scripts live OUTSIDE this repo:
- **Lyric library (markdown):** `/Users/chanfamilysg.ai/Desktop/AI Life/Church/Sembawang_Baptist_Church/worship-songs/lyrics/` — one `.md` per song (Simplified Chinese; Stream-of-Praise songs carry per-line English). 6.2 GB of originals (scores/audio/video) in `worship-songs/_originals/` (git-ignored).
- **Build scripts:** `/Users/chanfamilysg.ai/Desktop/AI Workflow/sbc-transcription/` with venv `.venv-cloudinary` (cloudinary + zhconv + pinyin).
  - `build_song_catalog.py` → `song_catalog.json` (merges md + media into one row per song; folds 繁→简; splits real English vs pinyin).
  - `upload_to_cloudinary.py` → uploads scores/videos/audio, writes `cloudinary_map.json` (resumable).
  - `build_import.py` → `import_rows.json` (catalog + inferred description/tags + Cloudinary URLs; no pinyin).
  - `insert_songs.py --go` → bulk-insert rows via the Supabase REST API (clears + re-inserts).
  - `merge_clean.py --go` → dedupe/clean the **live DB** (M# prefixes, variant chars, junk suffixes; absorbs media into the kept song).
  - `md_dedup.py --go` → dedupe the **md library** (keeps English version, preserves （subtitle） variants).
  - `build_index.py` → regenerates `worship-songs/_song-index.md`.

## 10. How to add / update songs
- **One-off:** use the **admin table** at `/admin` (add/edit/delete) — writes straight to Supabase.
- **Bulk re-import:** edit the md library → `build_song_catalog.py` → (upload new media) → `build_import.py` → `insert_songs.py --go`.
- After any data change the public site reflects it on reload (React Query refetch).

## 11. Conventions / rules (important)
- **Never machine-translate.** English title/lyrics only from real printed English.
- **Simplified Chinese** throughout (fold Traditional with `zhconv`).
- **Pinyin is generated, never stored.**
- Exclude non-Christian secular karaoke tracks.
- Keep `（subtitle）` song variants distinct; merge only true duplicates.

## 12. Open follow-ups
- **Audio:** 68 accompaniment tracks already in Cloudinary (`sembawangbaptistworship/audio/`). Needs an `audio_url` column + a small player section to surface them.
- **Lock down writes:** RLS currently allows anonymous writes (left open so the bulk import could run). Add a policy restricting INSERT/UPDATE/DELETE to the admin email once the admin account exists.
- **Admin account:** create via `/admin` → "Create the admin account", or in the Supabase dashboard (auto-confirmed).

---
_Related session memory: `project_sbc_worship_app.md`, `project_sbc_sermon_archive.md` in the AI CRM memory store._
