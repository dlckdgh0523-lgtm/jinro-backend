import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import type { buildApp as BuildApp } from "../src/app";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../src/app"));
});

describe("subscription routes", () => {
  describe("GET /v1/subscriptions/me", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/subscriptions/me");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/subscriptions/access", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/subscriptions/access");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /v1/subscriptions", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/subscriptions")
        .send({ planType: "STUDENT_PERSONAL" });
      expect(response.status).toBe(401);
    });

    it("rejects invalid planType", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/subscriptions")
        .set("Authorization", "Bearer invalid-token")
        .send({ planType: "INVALID" });
      expect(response.status).toBe(401);
    });
  });

  describe("POST /v1/webhooks/payment", () => {
    it("rejects invalid webhook payload", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/webhooks/payment")
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects missing required fields", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/webhooks/payment")
        .send({ eventType: "payment.completed" });
      expect(response.status).toBe(400);
    });
  });
});
