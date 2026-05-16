import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { buildApp as BuildApp } from "../../src/app";
import { makeAccessToken, makeExpiredToken } from "../helpers/auth";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../../src/app"));
});

describe("subscription integration", () => {
  describe("GET /v1/subscriptions/me", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/subscriptions/me");
      expect(res.status).toBe(401);
    });

    it("rejects expired token", async () => {
      const app = buildApp();
      const token = makeExpiredToken("user-1");
      const res = await request(app)
        .get("/v1/subscriptions/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /v1/subscriptions/me/active", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/subscriptions/me/active");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /v1/subscriptions", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/subscriptions").send({});
      expect(res.status).toBe(401);
    });

    it("rejects invalid plan type", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1");
      const res = await request(app)
        .post("/v1/subscriptions")
        .set("Authorization", `Bearer ${token}`)
        .send({ planType: "INVALID_PLAN" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects empty body", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1");
      const res = await request(app)
        .post("/v1/subscriptions")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("accepts valid STUDENT_PERSONAL plan", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1");
      const res = await request(app)
        .post("/v1/subscriptions")
        .set("Authorization", `Bearer ${token}`)
        .send({ planType: "STUDENT_PERSONAL" });
      // Will fail at DB level (500) but not at validation (400) or auth (401)
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
    });

    it("accepts valid TEACHER_CLASSROOM plan", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1");
      const res = await request(app)
        .post("/v1/subscriptions")
        .set("Authorization", `Bearer ${token}`)
        .send({ planType: "TEACHER_CLASSROOM" });
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
    });
  });

  describe("POST /v1/subscriptions/:id/cancel", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/subscriptions/some-id/cancel").send({});
      expect(res.status).toBe(401);
    });

    it("accepts optional reason in body", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1");
      const res = await request(app)
        .post("/v1/subscriptions/some-id/cancel")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "too expensive" });
      // Should not fail validation
      expect(res.status).not.toBe(400);
    });
  });

  describe("GET /v1/subscriptions/access", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/subscriptions/access");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /v1/webhooks/payment", () => {
    it("rejects empty body", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/webhooks/payment").send({});
      expect(res.status).toBe(400);
    });

    it("rejects missing required fields", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/webhooks/payment").send({
        eventType: "payment.approved"
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid status enum", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/webhooks/payment").send({
        eventType: "payment.done",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "INVALID_STATUS"
      });
      expect(res.status).toBe(400);
    });

    it("accepts valid webhook payload (APPROVED)", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/webhooks/payment").send({
        eventType: "payment.approved",
        pgPaymentId: "pg-123",
        idempotencyKey: "key-1",
        status: "APPROVED",
        amountKrw: 3000,
        metadata: { subscriptionId: "sub-1", userId: "user-1" }
      });
      // Not a validation error - will fail at DB level
      expect(res.status).not.toBe(400);
    });

    it("accepts valid webhook payload (FAILED)", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/webhooks/payment").send({
        eventType: "payment.failed",
        pgPaymentId: "pg-456",
        idempotencyKey: "key-2",
        status: "FAILED",
        metadata: { subscriptionId: "sub-1", userId: "user-1", failureReason: "declined" }
      });
      expect(res.status).not.toBe(400);
    });

    it("accepts valid webhook payload (CANCELED)", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/webhooks/payment").send({
        eventType: "payment.canceled",
        pgPaymentId: "pg-789",
        idempotencyKey: "key-3",
        status: "CANCELED"
      });
      expect(res.status).not.toBe(400);
    });

    it("accepts valid webhook payload (REFUNDED)", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/webhooks/payment").send({
        eventType: "payment.refunded",
        pgPaymentId: "pg-012",
        idempotencyKey: "key-4",
        status: "REFUNDED"
      });
      expect(res.status).not.toBe(400);
    });
  });
});
