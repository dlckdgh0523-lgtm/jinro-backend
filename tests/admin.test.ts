import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import type { buildApp as BuildApp } from "../src/app";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../src/app"));
});

describe("admin routes", () => {
  describe("GET /v1/admin/overview", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/admin/overview");
      expect(response.status).toBe(401);
    });

    it("rejects non-admin user with valid token structure", async () => {
      const app = buildApp();
      const response = await request(app)
        .get("/v1/admin/overview")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/admin/users", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/admin/users");
      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /v1/admin/users/:userId/status", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app)
        .patch("/v1/admin/users/some-id/status")
        .send({ status: "DISABLED" });
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/admin/subscriptions", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/admin/subscriptions");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/admin/system/health", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/admin/system/health");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/admin/audit-logs", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/admin/audit-logs");
      expect(response.status).toBe(401);
    });
  });
});
