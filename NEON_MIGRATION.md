# Supabase → Neon migration (worship app)

Started 2026-07-05. Same motion as Qweaver Loom cutover (2026-07-02). Decisions (Samuel):
auth = **Auth.js / Sam Stack** (custom HMAC cookie session, mirror QweaverOS `src/server/qweaver-auth.ts`),
cutover = **I prep, Samuel ships** (vercel env + `deploy --prod` are gated for the agent).

## Facts
- **Repo**: `~/Documents/GitHub/Samuel/sembawangbaptistworship` (TanStack Start + React + bun). Vercel project `sembawangbaptistworship`, git-integration deploy.
- **Neon**: org `org-wild-cherry-90423586`; API key `NEON_API_KEY` in `~/.config/neon-saia.env`; `neonctl` needs `--org-id`. Region `aws-ap-southeast-1` (Singapore), PG17. New project to create: `sembawangbaptistworship`.
- **Old Supabase**: project `bpdifamrojoqloifcleh` (Lovable-managed, NOT under Samuel's CLI/MCP). Read is public (anon RLS allow) → export songs via REST `…/rest/v1/songs?select=*` with anon apikey from tracked `.env`. Keep Supabase paused 30d as rollback.
- **songs schema** (from `supabase/migrations/`): id uuid pk default gen_random_uuid, title text NOT NULL, description/lyrics/pinyin/score_url/video_url text default '', created_at/updated_at timestamptz default now(), tags text[] default '{}', tags_text text default '', title_en/lyrics_en text default '', video_status text default 'none' CHECK(none/pending/approved/rejected), video_source text default '' CHECK(''/cloudinary/youtube/direct). Triggers: normalize_song_tags, normalize_song_video. Extensions: pgcrypto (gen_random_uuid), pg_trgm (trigram indexes).
- **Data layer**: `src/lib/songs.ts` uses browser `supabase.from('songs')` — fetchSongs (select *), searchSongs, createSong, updateSong, setSongVideoCandidate/Status, deleteSong. Search is CLIENT-SIDE after fetch → reads are just "select * order by title".
- **Auth**: `src/hooks/use-auth.ts` (Supabase email/pw) gates `/admin` route. Public `/` is read-only.

## Plan / status
1. [x] Neon access + Auth.js reference (QweaverOS `qweaver-auth.ts`: `postgres` lib, HMAC cookie `__Secure-*_session`, `auth_users(id,email,name,role,password_hash)`).
2. [ ] Create Neon project + apply schema (songs + auth_users + extensions + triggers).
3. [ ] Export songs from Supabase → import to Neon; verify count parity (~782).
4. [ ] Data layer → TanStack Start server functions over Neon (`postgres` lib). Rewrite songs.ts.
5. [ ] Auth.js/Sam Stack: mirror qweaver-auth.ts; seed admin user; replace use-auth + admin gate.
6. [ ] Local build + verify; write Samuel's prod ship commands; keep Supabase 30d rollback.

## Env plan (worship app on Neon)
- `DATABASE_URL` (Neon pooled) — server only. THE ONLY new env needed.
- No auth secret needed — sessions are DB-backed random tokens (auth_sessions), not HMAC-signed.
- keep `VITE_CLOUDINARY_*` (unchanged). Drop `VITE_SUPABASE_*` + `SUPABASE_*` after cutover.

## DONE (2026-07-05, verified locally)
- Neon project `sembawangbaptistworship` = **morning-haze-76154224** (PG17, ap-southeast-1).
- Schema applied (`db/neon-schema.sql` + auth_sessions). **782 songs imported** (parity verified: 206 English, tags consistent).
- Data layer → server functions (`src/lib/api/songs.functions.ts`, `src/lib/db.server.ts`); `src/lib/songs.ts` rewritten. Supabase integration fully unwired.
- Auth → Sam Stack (`src/server/auth.ts` scrypt + DB sessions; `src/lib/api/auth.functions.ts`; `src/hooks/use-auth.ts`). Admin user seeded (me@5amuelchan.com).
- **Verified**: build clean, postgres server-only (no client leak), 51 unit tests pass, homepage renders all 782 songs on Neon with Supabase env UNSET, admin login page renders, seeded credential verifies (scrypt).

## SHIP RUNBOOK (Samuel runs — prod deploy is gated for the agent)
1. Vercel project `sembawangbaptistworship` → Settings → Environment Variables → add for **Production** (and Preview):
   `DATABASE_URL` = the Neon pooled string (get: `neonctl connection-string --project-id morning-haze-76154224 --org-id org-wild-cherry-90423586 --pooled`). It's also in local `.env.local`.
2. (optional) remove `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_*` from Vercel.
3. Deploy: merge branch `neon-migration` → `main` (git-integration builds) OR `vercel --prod`.
4. Verify prod: song count shows 782; `/admin` login with the seeded creds; add/edit a song.
5. Rollback (30 days): revert the migration commit + redeploy. Old Supabase project `bpdifamrojoqloifcleh` is untouched — pause it, don't delete, for 30 days.

Admin login: `me@5amuelchan.com` (password handed over separately). Reset anytime: `bun db/seed-admin.mjs <email> <newpassword>` with DATABASE_URL set.
