import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUnavailable } from "@/server/apiGuard";

export const GET = withUnavailable(
  "contribution status",
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const contribution = await prisma.contribution.findUnique({
      where: { id },
      select: { id: true, status: true, amount: true, teamId: true },
    });
    if (!contribution) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(contribution);
  }
);
