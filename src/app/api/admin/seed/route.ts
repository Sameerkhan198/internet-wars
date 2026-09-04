import { NextResponse } from "next/server";
import { seedDemoData } from "@/server/seedDemoData";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Loads demo data into whatever database this instance is connected to.
 *
 * Reachable only with a valid admin session (enforced in src/proxy.ts, which
 * gates every /api/admin route). It exists so a hosted deployment can be
 * seeded from its own admin dashboard, without the production connection
 * string ever leaving the host.
 *
 * This DELETES all existing campaign data before reseeding — it is a demo
 * fixture loader, not a migration, and must be removed or disabled before any
 * real contributions are accepted.
 */
export async function POST() {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Seeding is only available while DEMO_MODE is enabled." },
      { status: 403 }
    );
  }

  try {
    const result = await seedDemoData();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("seed error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Seeding failed: ${message}` }, { status: 500 });
  }
}
