import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, looksLikeSessionToken } from "@/lib/adminCookie";

/**
 * Admin authentication — per-person AdminUser accounts, scrypt password
 * hashes, and database-backed sessions.
 *
 * - Passwords: Node's built-in scrypt (N=2^15, r=8, p=1), random 16-byte
 *   salt, stored self-describing so parameters can be raised later.
 * - Sessions: the cookie carries 32 random bytes; the DB stores only their
 *   SHA-256. A session is valid while not revoked and not expired (12h).
 *   Logout revokes it server-side, so a copied cookie stops working too.
 * - Every admin page calls requireAdminPage(); every admin API calls
 *   requireAdminApi(). The proxy's cookie check is only a fast pre-filter.
 * - Mutations additionally require a same-origin Origin header (CSRF
 *   defence on top of the SameSite=Strict cookie).
 * - First account: INITIAL_ADMIN_EMAIL + the existing deployment secret
 *   ADMIN_PASSWORD, accepted ONLY while no admin exists (see bootstrapAdmin).
 */

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 12;

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, keylen, { N, r, p, maxmem: SCRYPT.maxmem }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p), expected.length);
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// Burns the same work as a real check, so "no such email" and "wrong
// password" take the same time.
const DUMMY_HASH_PROMISE = hashPassword(crypto.randomBytes(16).toString("hex"));

export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 200) return "Password is too long.";
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function authenticate(email: string, password: string) {
  const admin = await prisma.adminUser.findUnique({ where: { email: normalizeEmail(email) } });
  if (!admin) {
    await verifyPassword(password, await DUMMY_HASH_PROMISE);
    return null;
  }
  return (await verifyPassword(password, admin.passwordHash)) ? admin : null;
}

export async function createSession(adminUserId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.$transaction([
    prisma.adminSession.create({ data: { tokenHash: sha256(token), adminUserId, expiresAt } }),
    prisma.adminUser.update({ where: { id: adminUserId }, data: { lastLoginAt: new Date() } }),
  ]);
  return { token, expiresAt };
}

export async function getAdminForToken(token: string | undefined | null) {
  if (!looksLikeSessionToken(token)) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256(token!) },
    include: { adminUser: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return { id: session.adminUser.id, email: session.adminUser.email, role: session.adminUser.role, sessionId: session.id };
}

export async function revokeSession(token: string | undefined | null) {
  if (!looksLikeSessionToken(token)) return;
  await prisma.adminSession.updateMany({
    where: { tokenHash: sha256(token!), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function sessionCookie(token: string, expiresAt: Date) {
  return {
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

export async function getCurrentAdmin() {
  const store = await cookies();
  return getAdminForToken(store.get(ADMIN_COOKIE)?.value);
}

/** For admin pages (Server Components): redirects to login when not signed in. */
export async function requireAdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/**
 * True when the request's Origin matches the host it was sent to. Browsers
 * always send Origin on POST/PUT/PATCH/DELETE fetches; a missing or foreign
 * Origin on a mutation is refused.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

type AdminIdentity = NonNullable<Awaited<ReturnType<typeof getAdminForToken>>>;

/**
 * For admin API routes. Returns the admin, or a ready-made error response.
 * Mutations (anything but GET/HEAD) must also be same-origin.
 */
export async function requireAdminApi(
  request: Request
): Promise<{ admin: AdminIdentity; response?: undefined } | { admin?: undefined; response: NextResponse }> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && !isSameOrigin(request)) {
    return { response: NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 }) };
  }
  const admin = await getCurrentAdmin();
  if (!admin) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { admin };
}

// ---------------- first-admin bootstrap ----------------

/** Open only while there are zero admins AND both bootstrap env vars are set. */
export async function isBootstrapOpen(): Promise<boolean> {
  if (!process.env.INITIAL_ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return false;
  return (await prisma.adminUser.count()) === 0;
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export class BootstrapError extends Error {}

/**
 * Creates the FIRST admin. Requires the configured INITIAL_ADMIN_EMAIL and the
 * deployment's existing ADMIN_PASSWORD as a one-time setup secret (it is never
 * stored — the admin picks a new password). Serialised with an advisory lock
 * and re-checks "no admins yet" inside the transaction, so two simultaneous
 * setups can't both succeed. After this, ADMIN_PASSWORD is unused.
 */
export async function bootstrapAdmin(input: { email: string; setupSecret: string; newPassword: string }) {
  const configuredEmail = process.env.INITIAL_ADMIN_EMAIL;
  const secret = process.env.ADMIN_PASSWORD;
  if (!configuredEmail || !secret) throw new BootstrapError("Admin setup is not enabled on this deployment.");

  const emailOk = safeEqual(normalizeEmail(input.email), normalizeEmail(configuredEmail));
  const secretOk = safeEqual(input.setupSecret, secret);
  if (!emailOk || !secretOk) throw new BootstrapError("Setup details are not correct.");

  const problem = validateNewPassword(input.newPassword);
  if (problem) throw new BootstrapError(problem);
  if (safeEqual(input.newPassword, secret)) throw new BootstrapError("Choose a new password, not the setup secret.");

  const passwordHash = await hashPassword(input.newPassword);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('iw_admin_bootstrap'))`;
    if ((await tx.adminUser.count()) > 0) throw new BootstrapError("An admin account already exists. Please sign in.");
    return tx.adminUser.create({ data: { email: normalizeEmail(configuredEmail), passwordHash, role: "ADMIN" } });
  });
}
