import crypto from "crypto";

// Minimal shared-secret admin gate for the MVP. This is intentionally simple —
// before production, replace with a real auth provider (NextAuth, Clerk, etc.)
// backed by the AdminUser table (email + hashed password, roles).
const SECRET = process.env.ADMIN_SESSION_SECRET ?? "demo_admin_secret_change_me";
export const ADMIN_COOKIE = "iw_admin_session";

export function signAdminSession(): string {
  const issuedAt = Date.now().toString();
  const sig = crypto.createHmac("sha256", SECRET).update(issuedAt).digest("hex");
  return `${issuedAt}.${sig}`;
}

export function verifyAdminSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const [issuedAt, sig] = token.split(".");
  if (!issuedAt || !sig) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(issuedAt).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const age = Date.now() - Number(issuedAt);
  return age >= 0 && age < 12 * 60 * 60 * 1000; // 12h session
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
