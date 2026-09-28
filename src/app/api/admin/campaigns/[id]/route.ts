import { NextResponse } from "next/server";
import { requireAdminApi } from "@/server/adminAuth";
import { updateCampaign } from "@/server/campaignAdmin";
import { adminErrorResponse } from "@/server/adminRoute";

/** Edit a campaign. Which fields are accepted depends on its status. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  try {
    const campaign = await updateCampaign(id, await request.json().catch(() => ({})));
    console.warn(`[admin] ${auth.admin.email} edited campaign ${campaign.slug}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminErrorResponse(err, "update campaign");
  }
}
