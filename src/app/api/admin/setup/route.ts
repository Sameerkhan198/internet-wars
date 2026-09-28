import { NextResponse } from "next/server";
import { z } from "zod";
import { BootstrapError, bootstrapAdmin, createSession, isBootstrapOpen, isSameOrigin, sessionCookie } from "@/server/adminAuth";
import { checkRateLimit, getClientIp } from "@/server/rateLimit";

const setupSchema = z.object({
  email: z.string().min(3).max(200),
  setupSecret: z.string().min(1).max(500),
  newPassword: z.string().min(1).max(200),
});

/**
 * One-time creation of the first admin account. Closed (404) as soon as any
 * admin exists, or when INITIAL_ADMIN_EMAIL / ADMIN_PASSWORD aren't set.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  }
  if (!(await isBootstrapOpen())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rate = await checkRateLimit(`admin_setup:ip:${getClientIp(request)}`, 5, 15 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = setupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Fill in every field." }, { status: 400 });
  }

  try {
    const admin = await bootstrapAdmin(parsed.data);
    const { token, expiresAt } = await createSession(admin.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookie(token, expiresAt));
    return res;
  } catch (err) {
    if (err instanceof BootstrapError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("admin setup failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Setup failed. Please try again." }, { status: 500 });
  }
}
