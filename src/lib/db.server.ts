// Shared Neon (Postgres) client. Server-only (.server.ts → never bundled to
// the browser). Read DATABASE_URL lazily so it resolves per-request on
// serverless. Mirrors the Sam Stack pattern (postgres lib, small pool).
import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!client) {
    client = postgres(url, { max: 5, idle_timeout: 20, onnotice: () => {} });
  }
  return client;
}
