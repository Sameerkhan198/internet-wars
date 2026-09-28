// Edge/proxy-safe constants for the admin session cookie. No crypto, no DB —
// the proxy only does an optimistic shape check; real verification happens in
// src/server/adminAuth.ts next to the data.
export const ADMIN_COOKIE = "iw_admin_session";

/** 32 random bytes, base64url — 43 chars. */
export function looksLikeSessionToken(token: string | undefined | null): boolean {
  return !!token && /^[A-Za-z0-9_-]{43}$/.test(token);
}
