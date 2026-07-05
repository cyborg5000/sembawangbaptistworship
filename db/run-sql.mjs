// Run a .sql file against Neon (DATABASE_URL from .env.local). Usage: bun db/run-sql.mjs <file>
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL not set'); process.exit(1) }
const file = process.argv[2]
if (!file) { console.error('usage: bun db/run-sql.mjs <file.sql>'); process.exit(1) }

const sql = postgres(url, { max: 1, onnotice: () => {} })
try {
  const text = readFileSync(file, 'utf8')
  await sql.unsafe(text) // simple protocol: allows multiple statements + dollar-quoted bodies
  console.log('applied:', file)
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
