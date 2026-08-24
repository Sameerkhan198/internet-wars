import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkAdminPassword, signAdminSession } from "@/lib/adminAuth";
import { checkRateLimit, getClientIp } from "@/server/rateLimit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = await checkRateLimit(`admin_login:${ip}`, 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password || !checkAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, signAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60,
    path: "/",
  });
  return res;
}
