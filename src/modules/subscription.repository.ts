import { prisma } from "../infra/prisma";
import type { PlanType, SubscriptionStatus } from "@prisma/client";

const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const subscriptionRepository = {
  findActiveByUserId(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["TRIALING", "ACTIVE"] }
      },
      orderBy: { createdAt: "desc" }
    });
  },

  findByUserId(userId: string) {
    return prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  },

  findById(id: string) {
    return prisma.subscription.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: "desc" }, take: 10 } }
    });
  },

  hasUsedTrial(userId: string, planType: PlanType) {
    return prisma.subscription.findFirst({
      where: { userId, planType },
      select: { id: true }
    });
  },

  create(input: {
    userId: string;
    planType: PlanType;
    priceKrw: number;
    maxStudents: number;
    isTrial: boolean;
  }) {
    const now = new Date();
    const trialEndsAt = input.isTrial ? new Date(now.getTime() + TRIAL_DURATION_MS) : null;

    return prisma.subscription.create({
      data: {
        userId: input.userId,
        planType: input.planType,
        status: input.isTrial ? "TRIALING" : "ACTIVE",
        priceKrw: input.priceKrw,
        maxStudents: input.maxStudents,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt ?? new Date(now.getTime() + TRIAL_DURATION_MS),
        events: {
          create: {
            eventType: input.isTrial ? "TRIAL_STARTED" : "SUBSCRIPTION_CREATED",
            toStatus: input.isTrial ? "TRIALING" : "ACTIVE"
          }
        }
      }
    });
  },

  updateStatus(id: string, status: SubscriptionStatus, reason?: string) {
    return prisma.$transaction([
      prisma.subscription.update({
        where: { id },
        data: {
          status,
          canceledAt: status === "CANCELED" ? new Date() : undefined
        }
      }),
      prisma.subscriptionEvent.create({
        data: {
          subscriptionId: id,
          eventType: `STATUS_CHANGED_TO_${status}`,
          toStatus: status,
          reason
        }
      })
    ]);
  },

  findPaymentByIdempotencyKey(idempotencyKey: string) {
    return prisma.payment.findUnique({
      where: { idempotencyKey }
    });
  },

  createPayment(input: {
    subscriptionId: string;
    userId: string;
    amountKrw: number;
    idempotencyKey: string;
    pgPaymentId?: string;
    pgProvider?: string;
    status: "REQUESTED" | "APPROVED" | "FAILED" | "CANCELED" | "REFUNDED";
  }) {
    return prisma.payment.create({
      data: {
        subscriptionId: input.subscriptionId,
        userId: input.userId,
        amountKrw: input.amountKrw,
        idempotencyKey: input.idempotencyKey,
        pgPaymentId: input.pgPaymentId,
        pgProvider: input.pgProvider,
        status: input.status,
        paidAt: input.status === "APPROVED" ? new Date() : undefined
      }
    });
  },

  listAll(page: number, pageSize: number) {
    return prisma.subscription.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true, role: true } } }
    });
  },

  countAll() {
    return prisma.subscription.count();
  }
};
