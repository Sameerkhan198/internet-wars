import crypto from "crypto";
import type {
  PaymentProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyPaymentResult,
  WebhookHandleResult,
  RefundResult,
} from "./provider";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "demo_webhook_secret_change_me";
const FAILURE_RATE = Number(process.env.DEMO_PAYMENT_FAILURE_RATE ?? "0.08");

// In-memory store for the demo provider's own bookkeeping. This simulates the
// external payment gateway's database — a real provider keeps this on their side.
type DemoOrder = {
  providerOrderId: string;
  providerTransactionId: string;
  amount: number;
  currency: string;
  contributionId: string;
  outcome: "SUCCESS" | "FAILED";
  status: "PENDING" | "SUCCESS" | "FAILED";
};

const demoOrders = new Map<string, DemoOrder>();

export function signDemoWebhook(payload: string): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
}

function verifyDemoWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signDemoWebhook(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const demoProvider: PaymentProvider = {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerOrderId = `demo_order_${crypto.randomUUID()}`;
    const providerTransactionId = `demo_txn_${crypto.randomUUID()}`;
    const outcome: "SUCCESS" | "FAILED" = Math.random() < FAILURE_RATE ? "FAILED" : "SUCCESS";

    demoOrders.set(providerOrderId, {
      providerOrderId,
      providerTransactionId,
      amount: input.amount,
      currency: input.currency,
      contributionId: input.contributionId,
      outcome,
      status: "PENDING",
    });

    return {
      providerOrderId,
      clientPayload: {
        demoMode: true,
        providerOrderId,
        amount: input.amount,
        currency: input.currency,
      },
    };
  },

  async verifyPayment(providerOrderId: string): Promise<VerifyPaymentResult> {
    const order = demoOrders.get(providerOrderId);
    if (!order) return { verified: false, status: "FAILED" };
    return {
      verified: order.status !== "PENDING",
      providerTransactionId: order.providerTransactionId,
      status: order.status,
    };
  },

  async handleWebhook(rawBody: string, headers: Headers): Promise<WebhookHandleResult> {
    const signature = headers.get("x-demo-signature");
    const authentic = verifyDemoWebhookSignature(rawBody, signature);
    const body = JSON.parse(rawBody) as {
      providerOrderId: string;
      providerTransactionId: string;
      status: "SUCCESS" | "FAILED";
    };

    if (authentic) {
      const order = demoOrders.get(body.providerOrderId);
      if (order) order.status = body.status;
    }

    return {
      providerOrderId: body.providerOrderId,
      providerTransactionId: body.providerTransactionId,
      status: body.status,
      authentic,
    };
  },

  async refundPayment(providerTransactionId: string): Promise<RefundResult> {
    for (const order of demoOrders.values()) {
      if (order.providerTransactionId === providerTransactionId) {
        return { refunded: true, providerRefundId: `demo_refund_${crypto.randomUUID()}` };
      }
    }
    return { refunded: false };
  },

  async getPaymentStatus(providerTransactionId: string) {
    for (const order of demoOrders.values()) {
      if (order.providerTransactionId === providerTransactionId) return order.status;
    }
    return "PENDING";
  },
};

/**
 * Simulates the external provider's async confirmation callback. A real
 * provider calls our webhook endpoint directly over HTTPS; here we build the
 * exact same signed payload and POST it to our own webhook route after a
 * short delay, so the verification code path is identical to production.
 */
export function scheduleDemoWebhookDelivery(providerOrderId: string, baseUrl: string) {
  const order = demoOrders.get(providerOrderId);
  if (!order) return;

  const delayMs = 1500 + Math.random() * 2500;
  setTimeout(async () => {
    const payload = JSON.stringify({
      providerOrderId: order.providerOrderId,
      providerTransactionId: order.providerTransactionId,
      status: order.outcome,
    });
    const signature = signDemoWebhook(payload);
    try {
      await fetch(`${baseUrl}/api/webhooks/demo`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-signature": signature },
        body: payload,
      });
    } catch {
      // In local dev the fetch itself can occasionally race server startup; the
      // demo UI also polls payment status separately so the user isn't stuck.
    }
  }, delayMs);
}

export function getPaymentProvider(): PaymentProvider {
  return demoProvider;
}
