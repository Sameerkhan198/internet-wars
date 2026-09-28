import { NextResponse } from "next/server";
import { seedDemoData } from "@/server/seedDemoData";
import { requireAdminApi } from "@/server/adminAuth";
import { DEMO_RESET_PHRASE, demoResetStatus } from "@/server/demoMode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * DESTRUCTIVE: deletes every campaign, contribution and activity event, then
 * loads a fresh demo battle.
 *
 * Guarded server-side, in order: signed-in admin + same-origin request
 * (requireAdminApi) → demo-only environment and ledger (demoResetStatus) →
 * the typed confirmation phrase in the request body.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;

  const status = await demoResetStatus();
  if (!status.allowed) {
    return NextResponse.json({ error: `Demo reset is disabled: ${status.reason}` }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== DEMO_RESET_PHRASE) {
    return NextResponse.json({ error: `Type "${DEMO_RESET_PHRASE}" to confirm.` }, { status: 400 });
  }

  try {
    const result = await seedDemoData();
    console.warn(`[admin] demo data reset by ${auth.admin.email}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("seed error", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Seeding failed. Check the server logs, then reload the admin page to see the current data." }, { status: 500 });
  }
}
