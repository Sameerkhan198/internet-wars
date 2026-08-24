import { NextResponse } from "next/server";
import { demoProvider } from "@/lib/payments/demoProvider";
import { applyWebhookResult, ContributionError } from "@/server/contributions";

/**
 * Receives the (simulated) payment provider's confirmation callback.
 * Signature is verified inside demoProvider.handleWebhook — an unauthenticated
 * payload is rejected before it can touch the ledger.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let result;
  try {
    result = await demoProvider.handleWebhook(rawBody, request.headers);
  } catch {
    return NextResponse.json({ error: "Malformed webhook payload" }, { status: 400 });
  }

  if (!result.authentic) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  try {
    await applyWebhookResult({
      providerOrderId: result.providerOrderId,
      providerTransactionId: result.providerTransactionId,
      status: result.status === "SUCCESS" ? "SUCCESS" : "FAILED",
      authentic: result.authentic,
      rawBody,
    });
  } catch (err) {
    if (err instanceof ContributionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("webhook processing error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
