// Import songs JSON export into Neon. Usage: bun db/import-songs.mjs <songs.json>
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL not set'); process.exit(1) }
const file = process.argv[2]
if (!file) { console.error('usage: bun db/import-songs.mjs <songs.json>'); process.exit(1) }

const rows = JSON.parse(readFileSync(file, 'utf8'))
const sql = postgres(url, { max: 1, onnotice: () => {} })

const clean = rows.map(r => ({
  id: r.id,
  title: r.title ?? '',
  description: r.description ?? '',
  lyrics: r.lyrics ?? '',
  pinyin: r.pinyin ?? '',
  score_url: r.score_url ?? '',
  video_url: r.video_url ?? '',
  tags: Array.isArray(r.tags) ? r.tags : [],
  title_en: r.title_en ?? '',
  lyrics_en: r.lyrics_en ?? '',
  created_at: r.created_at ?? new Date().toISOString(),
}))

try {
  const cols = ['id','title','description','lyrics','pinyin','score_url','video_url','tags','title_en','lyrics_en','created_at']
  // insert in chunks; trigger recomputes tags_text + updated_at
  let n = 0
  for (let i = 0; i < clean.length; i += 200) {
    const chunk = clean.slice(i, i + 200)
    await sql`insert into public.songs ${sql(chunk, ...cols)} on conflict (id) do nothing`
    n += chunk.length
  }
  const [{ count }] = await sql`select count(*)::int as count from public.songs`
  console.log(`inserted attempts: ${n}, songs in Neon now: ${count}`)
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
