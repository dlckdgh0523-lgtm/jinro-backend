import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSubscription, makePayment } from "../helpers/fixtures";

vi.mock("../../src/modules/subscription.repository", () => ({
  subscriptionRepository: {
    findActiveByUserId: vi.fn(),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    hasUsedTrial: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    findPaymentByIdempotencyKey: vi.fn(),
    createPayment: vi.fn(),
    listAll: vi.fn(),
    countAll: vi.fn()
  }
}));

let subscriptionService: typeof import("../../src/modules/subscription.service").subscriptionService;
let subscriptionRepository: typeof import("../../src/modules/subscription.repository").subscriptionRepository;

beforeAll(async () => {
  const svc = await import("../../src/modules/subscription.service");
  const repo = await import("../../src/modules/subscription.repository");
  subscriptionService = svc.subscriptionService;
  subscriptionRepository = repo.subscriptionRepository;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("subscriptionService", () => {
  describe("createSubscription", () => {
    it("throws CONFLICT if user already has active subscription", async () => {
      const existing = makeSubscription();
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(existing as any);

      await expect(
        subscriptionService.createSubscription("user-1", { planType: "STUDENT_PERSONAL" })
      ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
    });

    it("creates trial subscription for first-time user", async () => {
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(null);
      vi.mocked(subscriptionRepository.hasUsedTrial).mockResolvedValue(null);
      const created = makeSubscription({ status: "TRIALING" });
      vi.mocked(subscriptionRepository.create).mockResolvedValue(created as any);

      const result = await subscriptionService.createSubscription("user-1", { planType: "STUDENT_PERSONAL" });

      expect(subscriptionRepository.create).toHaveBeenCalledWith({
        userId: "user-1",
        planType: "STUDENT_PERSONAL",
        priceKrw: 3000,
        maxStudents: 0,
        isTrial: true
      });
      expect(result).toEqual(created);
    });

    it("creates paid subscription if user already used trial", async () => {
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(null);
      vi.mocked(subscriptionRepository.hasUsedTrial).mockResolvedValue(makeSubscription({ status: "EXPIRED" }) as any);
      const created = makeSubscription({ status: "ACTIVE" });
      vi.mocked(subscriptionRepository.create).mockResolvedValue(created as any);

      await subscriptionService.createSubscription("user-1", { planType: "STUDENT_PERSONAL" });

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isTrial: false })
      );
    });

    it("uses correct pricing for TEACHER_CLASSROOM plan", async () => {
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(null);
      vi.mocked(subscriptionRepository.hasUsedTrial).mockResolvedValue(null);
      vi.mocked(subscriptionRepository.create).mockResolvedValue(makeSubscription() as any);

      await subscriptionService.createSubscription("user-1", { planType: "TEACHER_CLASSROOM" });

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ priceKrw: 30000, maxStudents: 30 })
      );
    });
  });

  describe("cancelSubscription", () => {
    it("throws NOT_FOUND if subscription does not exist", async () => {
      vi.mocked(subscriptionRepository.findById).mockResolvedValue(null);

      await expect(
        subscriptionService.cancelSubscription("user-1", "sub-1")
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });

    it("throws NOT_FOUND if subscription belongs to different user", async () => {
      vi.mocked(subscriptionRepository.findById).mockResolvedValue(
        makeSubscription({ userId: "other-user" }) as any
      );

      await expect(
        subscriptionService.cancelSubscription("user-1", "sub-1")
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });

    it("throws CONFLICT if subscription is already canceled", async () => {
      vi.mocked(subscriptionRepository.findById).mockResolvedValue(
        makeSubscription({ userId: "user-1", status: "CANCELED" }) as any
      );

      await expect(
        subscriptionService.cancelSubscription("user-1", "sub-1")
      ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
    });

    it("throws CONFLICT if subscription is expired", async () => {
      vi.mocked(subscriptionRepository.findById).mockResolvedValue(
        makeSubscription({ userId: "user-1", status: "EXPIRED" }) as any
      );

      await expect(
        subscriptionService.cancelSubscription("user-1", "sub-1")
      ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
    });

    it("cancels an active subscription with reason", async () => {
      const sub = makeSubscription({ userId: "user-1", status: "ACTIVE" });
      vi.mocked(subscriptionRepository.findById).mockResolvedValue(sub as any);
      const updated = { ...sub, status: "CANCELED" };
      vi.mocked(subscriptionRepository.updateStatus).mockResolvedValue([updated as any, {} as any]);

      const result = await subscriptionService.cancelSubscription("user-1", sub.id, "changed mind");

      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(sub.id, "CANCELED", "changed mind");
      expect(result).toEqual(updated);
    });

    it("cancels a trialing subscription", async () => {
      const sub = makeSubscription({ userId: "user-1", status: "TRIALING" });
      vi.mocked(subscriptionRepository.findById).mockResolvedValue(sub as any);
      vi.mocked(subscriptionRepository.updateStatus).mockResolvedValue([{ ...sub, status: "CANCELED" } as any, {} as any]);

      await subscriptionService.cancelSubscription("user-1", sub.id);

      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(sub.id, "CANCELED", undefined);
    });
  });

  describe("handlePaymentWebhook", () => {
    it("returns deduplicated=true if payment already processed", async () => {
      const existing = makePayment();
      vi.mocked(subscriptionRepository.findPaymentByIdempotencyKey).mockResolvedValue(existing as any);

      const result = await subscriptionService.handlePaymentWebhook({
        eventType: "payment.approved",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "APPROVED"
      });

      expect(result).toEqual({ deduplicated: true, paymentId: existing.id });
      expect(subscriptionRepository.createPayment).not.toHaveBeenCalled();
    });

    it("creates payment and activates subscription on APPROVED", async () => {
      vi.mocked(subscriptionRepository.findPaymentByIdempotencyKey).mockResolvedValue(null);
      const payment = makePayment();
      vi.mocked(subscriptionRepository.createPayment).mockResolvedValue(payment as any);
      vi.mocked(subscriptionRepository.updateStatus).mockResolvedValue([{} as any, {} as any]);

      const result = await subscriptionService.handlePaymentWebhook({
        eventType: "payment.approved",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "APPROVED",
        amountKrw: 3000,
        metadata: { subscriptionId: "sub-1", userId: "user-1" }
      });

      expect(result).toEqual({ deduplicated: false, paymentId: payment.id });
      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith("sub-1", "ACTIVE", "Payment approved");
    });

    it("creates payment and marks PAYMENT_FAILED on FAILED status", async () => {
      vi.mocked(subscriptionRepository.findPaymentByIdempotencyKey).mockResolvedValue(null);
      vi.mocked(subscriptionRepository.createPayment).mockResolvedValue(makePayment() as any);
      vi.mocked(subscriptionRepository.updateStatus).mockResolvedValue([{} as any, {} as any]);

      await subscriptionService.handlePaymentWebhook({
        eventType: "payment.failed",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-2",
        status: "FAILED",
        metadata: { subscriptionId: "sub-1", userId: "user-1", failureReason: "insufficient funds" }
      });

      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
        "sub-1", "PAYMENT_FAILED", "insufficient funds"
      );
    });

    it("does not update subscription status on CANCELED webhook", async () => {
      vi.mocked(subscriptionRepository.findPaymentByIdempotencyKey).mockResolvedValue(null);
      vi.mocked(subscriptionRepository.createPayment).mockResolvedValue(makePayment() as any);

      await subscriptionService.handlePaymentWebhook({
        eventType: "payment.canceled",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-3",
        status: "CANCELED",
        metadata: { subscriptionId: "sub-1", userId: "user-1" }
      });

      expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("checkAccess", () => {
    it("returns hasAccess=false with no subscription", async () => {
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(null);

      const result = await subscriptionService.checkAccess("user-1");

      expect(result).toEqual({ hasAccess: false, reason: "No active subscription." });
    });

    it("returns hasAccess=true for valid trial", async () => {
      const sub = makeSubscription({
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() + 86400000)
      });
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(sub as any);

      const result = await subscriptionService.checkAccess("user-1");

      expect(result).toEqual({ hasAccess: true });
    });

    it("expires trial and returns hasAccess=false if trial ended", async () => {
      const sub = makeSubscription({
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() - 86400000)
      });
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(sub as any);
      vi.mocked(subscriptionRepository.updateStatus).mockResolvedValue([{} as any, {} as any]);

      const result = await subscriptionService.checkAccess("user-1");

      expect(result).toEqual({ hasAccess: false, reason: "Trial has expired." });
      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(sub.id, "EXPIRED", "Trial ended");
    });

    it("returns hasAccess=true for active subscription within period", async () => {
      const sub = makeSubscription({
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000)
      });
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(sub as any);

      const result = await subscriptionService.checkAccess("user-1");

      expect(result).toEqual({ hasAccess: true });
    });

    it("expires active subscription if period ended", async () => {
      const sub = makeSubscription({
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() - 86400000)
      });
      vi.mocked(subscriptionRepository.findActiveByUserId).mockResolvedValue(sub as any);
      vi.mocked(subscriptionRepository.updateStatus).mockResolvedValue([{} as any, {} as any]);

      const result = await subscriptionService.checkAccess("user-1");

      expect(result).toEqual({ hasAccess: false, reason: "Subscription period has expired." });
      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(sub.id, "EXPIRED", "Period ended");
    });
  });
});
