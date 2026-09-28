import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CampaignAdminError } from "@/server/campaignAdmin";

/** Maps expected admin errors to 400s with a readable message; anything else is a 500. */
export function adminErrorResponse(err: unknown, label: string) {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json({ error: `${where}${issue?.message ?? "Invalid input"}` }, { status: 400 });
  }
  if (err instanceof CampaignAdminError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error(`[admin] ${label} failed:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
