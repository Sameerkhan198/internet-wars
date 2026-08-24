export type CreatePaymentInput = {
  contributionId: string;
  amount: number; // smallest currency unit
  currency: string;
  idempotencyKey: string;
};

export type CreatePaymentResult = {
  providerOrderId: string;
  /** Data the client uses to open the provider's payment UI (mock in demo mode). */
  clientPayload: Record<string, unknown>;
};

export type VerifyPaymentResult = {
  verified: boolean;
  providerTransactionId?: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
};

export type WebhookHandleResult = {
  providerTransactionId: string;
  providerOrderId: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  /** True once signature/authenticity has been verified. Never trust an unverified webhook. */
  authentic: boolean;
};

export type RefundResult = {
  refunded: boolean;
  providerRefundId?: string;
};

/**
 * Every payment provider (demo, and later Razorpay/Stripe/etc.) implements this
 * interface. No business logic anywhere should import a concrete provider directly —
 * always go through getPaymentProvider().
 */
export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(providerOrderId: string): Promise<VerifyPaymentResult>;
  handleWebhook(rawBody: string, headers: Headers): Promise<WebhookHandleResult>;
  refundPayment(providerTransactionId: string): Promise<RefundResult>;
  getPaymentStatus(providerTransactionId: string): Promise<VerifyPaymentResult["status"]>;
}
