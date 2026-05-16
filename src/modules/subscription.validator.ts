import { z } from "zod";

export const createSubscriptionSchema = z.object({
  planType: z.enum(["STUDENT_PERSONAL", "TEACHER_CLASSROOM"])
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().optional()
});

export const paymentWebhookSchema = z.object({
  eventType: z.string().min(1),
  pgPaymentId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  status: z.enum(["APPROVED", "FAILED", "CANCELED", "REFUNDED"]),
  amountKrw: z.coerce.number().int().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;
