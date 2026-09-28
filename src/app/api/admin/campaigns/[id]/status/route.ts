import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/server/adminAuth";
import { changeCampaignStatus } from "@/server/campaignAdmin";
import { adminErrorResponse } from "@/server/adminRoute";

const actionSchema = z.object({
  action: z.enum(["schedule", "unschedule", "start", "pause", "resume", "close", "cancel"]),
});

/** Status transitions: schedule / unschedule / start / pause / resume / close / cancel. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const { action } = actionSchema.parse(await request.json().catch(() => ({})));
    const campaign = await changeCampaignStatus(id, action);
    console.warn(`[admin] ${auth.admin.email}: ${action} → ${campaign.slug} is now ${campaign.status}`);
    return NextResponse.json({ ok: true, status: campaign.status });
  } catch (err) {
    return adminErrorResponse(err, "change campaign status");
  }
}
