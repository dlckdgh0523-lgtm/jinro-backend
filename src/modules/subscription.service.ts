import { ApiError } from "../common/http";
import { subscriptionRepository } from "./subscription.repository";
import type { CreateSubscriptionInput, PaymentWebhookInput } from "./subscription.validator";

const PLAN_CONFIG = {
  STUDENT_PERSONAL: { priceKrw: 3000, maxStudents: 0 },
  TEACHER_CLASSROOM: { priceKrw: 30000, maxStudents: 30 }
} as const;

export const subscriptionService = {
  async getActiveSubscription(userId: string) {
    return subscriptionRepository.findActiveByUserId(userId);
  },

  async getUserSubscriptions(userId: string) {
    return subscriptionRepository.findByUserId(userId);
  },

  async createSubscription(userId: string, input: CreateSubscriptionInput) {
    const existing = await subscriptionRepository.findActiveByUserId(userId);
    if (existing) {
      throw new ApiError(409, "CONFLICT", "User already has an active subscription.");
    }

    const config = PLAN_CONFIG[input.planType];
    const previousSub = await subscriptionRepository.hasUsedTrial(userId, input.planType);
    const isTrial = !previousSub;

    return subscriptionRepository.create({
      userId,
      planType: input.planType,
      priceKrw: config.priceKrw,
      maxStudents: config.maxStudents,
      isTrial
    });
  },

  async cancelSubscription(userId: string, subscriptionId: string, reason?: string) {
    const sub = await subscriptionRepository.findById(subscriptionId);
    if (!sub || sub.userId !== userId) {
      throw new ApiError(404, "NOT_FOUND", "Subscription not found.");
    }
    if (sub.status === "CANCELED" || sub.status === "EXPIRED") {
      throw new ApiError(409, "CONFLICT", "Subscription is already canceled.");
    }

    const [updated] = await subscriptionRepository.updateStatus(subscriptionId, "CANCELED", reason);
    return updated;
  },

  async handlePaymentWebhook(input: PaymentWebhookInput) {
    const existing = await subscriptionRepository.findPaymentByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return { deduplicated: true, paymentId: existing.id };
    }

    const payment = await subscriptionRepository.createPayment({
      subscriptionId: input.metadata?.subscriptionId as string ?? "",
      userId: input.metadata?.userId as string ?? "",
      amountKrw: input.amountKrw ?? 0,
      idempotencyKey: input.idempotencyKey,
      pgPaymentId: input.pgPaymentId,
      status: input.status
    });

    if (input.status === "APPROVED" && input.metadata?.subscriptionId) {
      await subscriptionRepository.updateStatus(
        input.metadata.subscriptionId as string,
        "ACTIVE",
        "Payment approved"
      );
    }

    if (input.status === "FAILED" && input.metadata?.subscriptionId) {
      await subscriptionRepository.updateStatus(
        input.metadata.subscriptionId as string,
        "PAYMENT_FAILED",
        input.metadata?.failureReason as string
      );
    }

    return { deduplicated: false, paymentId: payment.id };
  },

  async checkAccess(userId: string): Promise<{ hasAccess: boolean; reason?: string }> {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) {
      return { hasAccess: false, reason: "No active subscription." };
    }

    if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
      await subscriptionRepository.updateStatus(sub.id, "EXPIRED", "Trial ended");
      return { hasAccess: false, reason: "Trial has expired." };
    }

    if (sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
      await subscriptionRepository.updateStatus(sub.id, "EXPIRED", "Period ended");
      return { hasAccess: false, reason: "Subscription period has expired." };
    }

    return { hasAccess: true };
  }
};
