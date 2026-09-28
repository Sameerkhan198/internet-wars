import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/demoProvider";

/** Exact phrase the admin must type before the destructive demo reset runs. */
export const DEMO_RESET_PHRASE = "RESET DEMO DATA";

/**
 * Whether the destructive "load demo data" reset may run. Every condition is
 * checked on the server; hiding the button is only a convenience.
 *
 *  - DEMO_MODE must be explicitly "true";
 *  - REAL_PAYMENTS_ENABLED must not be "true" (the switch a real-money launch
 *    will flip);
 *  - the active payment provider must be the demo provider;
 *  - the ledger must contain no payment from any non-demo provider — once a
 *    single real payment exists, no configuration can wipe it.
 */
export async function demoResetStatus(): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  if (process.env.DEMO_MODE !== "true") return { allowed: false, reason: "Demo mode is not enabled." };
  if (process.env.REAL_PAYMENTS_ENABLED === "true") {
    return { allowed: false, reason: "Real payments are enabled on this deployment." };
  }
  if (getPaymentProvider().id !== "demo") {
    return { allowed: false, reason: "A real payment provider is configured." };
  }
  const realPayments = await prisma.payment.count({ where: { provider: { not: "demo" } } });
  if (realPayments > 0) {
    return { allowed: false, reason: "The ledger contains non-demo payments and can never be reset." };
  }
  return { allowed: true };
}
