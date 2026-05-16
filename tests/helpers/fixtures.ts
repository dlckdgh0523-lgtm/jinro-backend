import { randomUUID } from "node:crypto";

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    email: `test-${randomUUID().slice(0, 8)}@example.com`,
    role: "STUDENT" as const,
    status: "ACTIVE" as const,
    createdAt: new Date(),
    lastLoginAt: null,
    ...overrides
  };
}

export function makeSubscription(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: randomUUID(),
    planType: "STUDENT_PERSONAL" as const,
    status: "TRIALING" as const,
    trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    currentPeriodStart: now,
    currentPeriodEnd: null,
    canceledAt: null,
    maxStudents: 0,
    priceKrw: 3000,
    pgCustomerId: null,
    pgSubscriptionId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    subscriptionId: randomUUID(),
    userId: randomUUID(),
    amountKrw: 3000,
    status: "APPROVED" as const,
    pgPaymentId: `pg_${randomUUID()}`,
    pgProvider: "toss",
    failureReason: null,
    paidAt: new Date(),
    refundedAt: null,
    idempotencyKey: randomUUID(),
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

export function makeCounselingSession(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    studentProfileId: randomUUID(),
    status: "ACTIVE" as const,
    currentStep: 0,
    confidenceScore: 0,
    title: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    signals: [],
    hypotheses: [],
    report: null,
    ...overrides
  };
}

export function makeSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    category: "interests",
    value: "프로그래밍이 재밌어요",
    evidence: "코딩을 좋아한다고 함",
    confidence: 0.6,
    createdAt: new Date(),
    ...overrides
  };
}
