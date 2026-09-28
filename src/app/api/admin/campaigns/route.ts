import { NextResponse } from "next/server";
import { requireAdminApi } from "@/server/adminAuth";
import { createCampaign } from "@/server/campaignAdmin";
import { adminErrorResponse } from "@/server/adminRoute";

/** Create a campaign (always starts as DRAFT). */
export async function POST(request: Request) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  try {
    const campaign = await createCampaign(await request.json().catch(() => ({})));
    console.warn(`[admin] ${auth.admin.email} created campaign ${campaign.slug}`);
    return NextResponse.json({ id: campaign.id, slug: campaign.slug }, { status: 201 });
  } catch (err) {
    return adminErrorResponse(err, "create campaign");
  }
}
