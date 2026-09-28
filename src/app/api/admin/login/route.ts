import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, createSession, isSameOrigin, normalizeEmail, sessionCookie } from "@/server/adminAuth";
import { checkRateLimit, getClientIp } from "@/server/rateLimit";

const loginSchema = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const ipRate = await checkRateLimit(`admin_login:ip:${ip}`, 5, 60_000);
  if (!ipRate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Per-account limit too, so a distributed attempt on one email is slowed.
  const acctRate = await checkRateLimit(`admin_login:acct:${normalizeEmail(email)}`, 10, 15 * 60_000);
  if (!acctRate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const admin = await authenticate(email, password);
  if (!admin) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(admin.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(token, expiresAt));
  return res;
}
