import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { buildApp as BuildApp } from "../../src/app";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../../src/app"));
});

describe("health integration", () => {
  describe("GET /health", () => {
    it("returns 200 with success response", async () => {
      const app = buildApp();
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ok");
    });

    it("includes requestId in response", async () => {
      const app = buildApp();
      const res = await request(app).get("/health");
      expect(res.body.requestId).toBeDefined();
    });

    it("echoes x-request-id header", async () => {
      const app = buildApp();
      const res = await request(app)
        .get("/health")
        .set("x-request-id", "custom-request-id");
      expect(res.headers["x-request-id"]).toBe("custom-request-id");
    });

    it("is not rate limited", async () => {
      const app = buildApp();
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
      }
    });
  });

  describe("GET /health/ready", () => {
    it("returns response without crashing", async () => {
      const app = buildApp();
      const res = await request(app).get("/health/ready");
      // May fail DB check (500) or return healthy (200)
      expect([200, 500]).toContain(res.status);
      expect(res.body).toBeDefined();
    });
  });

  describe("404 handler", () => {
    it("returns 404 for unknown routes", async () => {
      const app = buildApp();
      const res = await request(app).get("/nonexistent-route");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for wrong HTTP method", async () => {
      const app = buildApp();
      const res = await request(app).delete("/health");
      expect(res.status).toBe(404);
    });

    it("includes route info in 404 error message", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/nonexistent");
      expect(res.body.error.message).toContain("/v1/nonexistent");
    });
  });

  describe("CORS", () => {
    it("allows configured origin", async () => {
      const app = buildApp();
      const res = await request(app)
        .get("/health")
        .set("Origin", "http://localhost:5173");
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });

    it("allows requests without origin (same-origin)", async () => {
      const app = buildApp();
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
    });
  });

  describe("security headers", () => {
    it("does not expose x-powered-by", async () => {
      const app = buildApp();
      const res = await request(app).get("/health");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("includes helmet security headers", async () => {
      const app = buildApp();
      const res = await request(app).get("/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });
  });

  describe("request body parsing", () => {
    it("parses JSON body", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/v1/auth/student/login")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ email: "test@test.com", password: "password123" }));
      // Should parse body correctly (validation runs, may fail at DB)
      expect(res.status).not.toBe(415);
    });

    it("rejects or errors on body exceeding 1mb", async () => {
      const app = buildApp();
      const largeBody = { data: "x".repeat(1024 * 1024 + 1) };
      const res = await request(app)
        .post("/v1/auth/student/login")
        .send(largeBody);
      // Express may return 413 (payload too large) or 500
      expect([413, 500]).toContain(res.status);
    });
  });
});
