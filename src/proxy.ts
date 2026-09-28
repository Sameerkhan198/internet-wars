import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, looksLikeSessionToken } from "@/lib/adminCookie";

/**
 * Optimistic pre-filter for /admin and /api/admin (Next 16's renamed
 * middleware). It only checks that a session cookie of the right shape is
 * present — no database access here, per Next's guidance. The real check
 * (session exists, not revoked, not expired) runs in every admin page and
 * API via src/server/adminAuth.ts. Removing this file would NOT open admin.
 */
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout", "/api/admin/setup"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();

  if (!looksLikeSessionToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
