// Seed / reset an admin user. Usage: bun db/seed-admin.mjs <email> [password]
// If password omitted, a strong one is generated and printed once.
import postgres from "postgres";
import crypto from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const email = process.argv[2];
if (!email) { console.error("usage: bun db/seed-admin.mjs <email> [password]"); process.exit(1); }
const password = process.argv[3] || crypto.randomBytes(15).toString("base64url");

function hashPassword(pw) {
  const N = 16384, r = 8, p = 1;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N, r, p });
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const hash = hashPassword(password);
  await sql`
    insert into public.auth_users (email, name, role, password_hash)
    values (${email}, ${"Admin"}, ${"admin"}, ${hash})
    on conflict (email) do update set password_hash = excluded.password_hash`;
  console.log("admin ready:", email);
  console.log("password:", password);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
