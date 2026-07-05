// Sam Stack auth for the worship app: scrypt password hashing + DB-backed
// sessions (auth_sessions) + HMAC-free random session token in an HttpOnly
// cookie. Mirrors QweaverOS src/server/qweaver-auth.ts, minus the Qweaver SSO
// bits. Server-only.
import crypto from "node:crypto";
import { getSql } from "@/lib/db.server";

// Plain name (no __Secure- prefix) so the cookie also works on http://localhost
// during local verification; Secure is still applied on https in production.
export const SESSION_COOKIE = "worship_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseCookies(request: Request) {
  const header = request.headers.get("cookie") || "";
  const cookies = new Map<string, string>();
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    cookies.set(part.slice(0, i), decodeURIComponent(part.slice(i + 1)));
  }
  return cookies;
}

function secureFlag(request: Request) {
  return new URL(request.url).protocol === "https:" ? "Secure" : "";
}

export function setSessionCookie(request: Request, token: string) {
  return [
    SESSION_COOKIE + "=" + encodeURIComponent(token),
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=" + SESSION_TTL_SECONDS,
    secureFlag(request),
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie(request: Request) {
  return [
    SESSION_COOKIE + "=",
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
    secureFlag(request),
  ].filter(Boolean).join("; ");
}

export function readSessionToken(request: Request) {
  return parseCookies(request).get(SESSION_COOKIE) || null;
}

export async function hashPassword(password: string) {
  const N = 16384, r = 8, p = 1;
  const salt = crypto.randomBytes(16);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N, r, p }, (e, dk) => (e ? reject(e) : resolve(dk)));
  });
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = encoded.split("$");
  if (scheme !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;
  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(hashRaw, "base64url");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, { N: Number(nRaw), r: Number(rRaw), p: Number(pRaw) },
      (e, dk) => (e ? reject(e) : resolve(dk)));
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function findUserByEmail(email: string) {
  const sql = getSql();
  const rows = await sql.unsafe(
    "select id, email, name, role, password_hash from auth_users where lower(email)=lower($1) limit 1",
    [email],
  );
  return (rows[0] as { id: string; email: string; name: string | null; role: string; password_hash: string } | undefined) ?? null;
}

export async function createSession(userId: string, request: Request) {
  const sql = getSql();
  const token = crypto.randomBytes(32).toString("base64url");
  await sql.unsafe(
    "insert into auth_sessions (user_id, token_hash, user_agent, expires_at) values ($1,$2,$3, now() + interval '30 days')",
    [userId, sha256(token), request.headers.get("user-agent") || null],
  );
  return token;
}

export async function revokeSession(request: Request) {
  const token = readSessionToken(request);
  if (!token) return;
  const sql = getSql();
  await sql.unsafe("update auth_sessions set revoked_at = now() where token_hash = $1", [sha256(token)]);
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const sql = getSql();
  const rows = await sql.unsafe(
    "select u.id, u.email, u.name, u.role from auth_sessions s join auth_users u on u.id = s.user_id where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() limit 1",
    [sha256(token)],
  );
  return (rows[0] as SessionUser | undefined) ?? null;
}

export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) throw new Error("Not authenticated");
  return user;
}
