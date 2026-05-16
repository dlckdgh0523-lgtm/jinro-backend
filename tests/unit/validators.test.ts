import { beforeAll, describe, expect, it } from "vitest";

let createSubscriptionSchema: typeof import("../../src/modules/subscription.validator").createSubscriptionSchema;
let cancelSubscriptionSchema: typeof import("../../src/modules/subscription.validator").cancelSubscriptionSchema;
let paymentWebhookSchema: typeof import("../../src/modules/subscription.validator").paymentWebhookSchema;
let createSessionSchema: typeof import("../../src/modules/career-counseling.validator").createSessionSchema;
let sendMessageSchema: typeof import("../../src/modules/career-counseling.validator").sendMessageSchema;

beforeAll(async () => {
  const subMod = await import("../../src/modules/subscription.validator");
  const ccMod = await import("../../src/modules/career-counseling.validator");
  createSubscriptionSchema = subMod.createSubscriptionSchema;
  cancelSubscriptionSchema = subMod.cancelSubscriptionSchema;
  paymentWebhookSchema = subMod.paymentWebhookSchema;
  createSessionSchema = ccMod.createSessionSchema;
  sendMessageSchema = ccMod.sendMessageSchema;
});

describe("subscription validators", () => {
  describe("createSubscriptionSchema", () => {
    it("accepts STUDENT_PERSONAL", () => {
      const result = createSubscriptionSchema.safeParse({ planType: "STUDENT_PERSONAL" });
      expect(result.success).toBe(true);
    });

    it("accepts TEACHER_CLASSROOM", () => {
      const result = createSubscriptionSchema.safeParse({ planType: "TEACHER_CLASSROOM" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid plan type", () => {
      const result = createSubscriptionSchema.safeParse({ planType: "ENTERPRISE" });
      expect(result.success).toBe(false);
    });

    it("rejects missing planType", () => {
      const result = createSubscriptionSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects empty string planType", () => {
      const result = createSubscriptionSchema.safeParse({ planType: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("cancelSubscriptionSchema", () => {
    it("accepts empty object (reason is optional)", () => {
      const result = cancelSubscriptionSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts reason string", () => {
      const result = cancelSubscriptionSchema.safeParse({ reason: "too expensive" });
      expect(result.success).toBe(true);
    });
  });

  describe("paymentWebhookSchema", () => {
    it("accepts valid APPROVED payload", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.approved",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "APPROVED",
        amountKrw: 3000
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid FAILED payload", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.failed",
        pgPaymentId: "pg-456",
        idempotencyKey: "key-2",
        status: "FAILED"
      });
      expect(result.success).toBe(true);
    });

    it("accepts metadata as record", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.approved",
        pgPaymentId: "pg-789",
        idempotencyKey: "key-3",
        status: "APPROVED",
        metadata: { subscriptionId: "sub-1", userId: "u1" }
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing eventType", () => {
      const result = paymentWebhookSchema.safeParse({
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "APPROVED"
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty eventType", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "APPROVED"
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing pgPaymentId", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.approved",
        idempotencyKey: "key-1",
        status: "APPROVED"
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing idempotencyKey", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.approved",
        pgPaymentId: "pg-123",
        status: "APPROVED"
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid status enum", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.done",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "PENDING"
      });
      expect(result.success).toBe(false);
    });

    it("coerces amountKrw string to number", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.approved",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "APPROVED",
        amountKrw: "3000"
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amountKrw).toBe(3000);
      }
    });

    it("accepts REFUNDED status", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.refunded",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "REFUNDED"
      });
      expect(result.success).toBe(true);
    });

    it("accepts CANCELED status", () => {
      const result = paymentWebhookSchema.safeParse({
        eventType: "payment.canceled",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "CANCELED"
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("career-counseling validators", () => {
  describe("createSessionSchema", () => {
    it("accepts empty object (title optional)", () => {
      const result = createSessionSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts title string", () => {
      const result = createSessionSchema.safeParse({ title: "내 진로 상담" });
      expect(result.success).toBe(true);
    });
  });

  describe("sendMessageSchema", () => {
    it("accepts valid content", () => {
      const result = sendMessageSchema.safeParse({ content: "안녕하세요" });
      expect(result.success).toBe(true);
    });

    it("rejects empty content", () => {
      const result = sendMessageSchema.safeParse({ content: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing content", () => {
      const result = sendMessageSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects content over 2000 chars", () => {
      const result = sendMessageSchema.safeParse({ content: "x".repeat(2001) });
      expect(result.success).toBe(false);
    });

    it("accepts content at exactly 2000 chars", () => {
      const result = sendMessageSchema.safeParse({ content: "x".repeat(2000) });
      expect(result.success).toBe(true);
    });

    it("accepts content at exactly 1 char", () => {
      const result = sendMessageSchema.safeParse({ content: "a" });
      expect(result.success).toBe(true);
    });
  });
});
