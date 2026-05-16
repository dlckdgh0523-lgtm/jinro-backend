import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { buildApp as BuildApp } from "../../src/app";
import { makeAccessToken } from "../helpers/auth";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../../src/app"));
});

describe("admin integration", () => {
  const adminEndpoints = [
    { method: "get" as const, path: "/v1/admin/overview" },
    { method: "get" as const, path: "/v1/admin/users" },
    { method: "get" as const, path: "/v1/admin/users/user-123" },
    { method: "get" as const, path: "/v1/admin/teachers" },
    { method: "get" as const, path: "/v1/admin/students" },
    { method: "get" as const, path: "/v1/admin/classrooms" },
    { method: "get" as const, path: "/v1/admin/subscriptions" },
    { method: "get" as const, path: "/v1/admin/ai-usage" },
    { method: "get" as const, path: "/v1/admin/audit-logs" },
    { method: "get" as const, path: "/v1/admin/system/health" }
  ];

  describe("authentication guard", () => {
    for (const endpoint of adminEndpoints) {
      it(`${endpoint.method.toUpperCase()} ${endpoint.path} rejects unauthenticated request`, async () => {
        const app = buildApp();
        const res = await request(app)[endpoint.method](endpoint.path);
        expect(res.status).toBe(401);
      });
    }
  });

  describe("authorization guard - STUDENT role denied", () => {
    for (const endpoint of adminEndpoints) {
      it(`${endpoint.method.toUpperCase()} ${endpoint.path} rejects STUDENT role`, async () => {
        const app = buildApp();
        const token = makeAccessToken("user-1", "STUDENT");
        const res = await request(app)[endpoint.method](endpoint.path)
          .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });
    }
  });

  describe("authorization guard - TEACHER role denied", () => {
    for (const endpoint of adminEndpoints) {
      it(`${endpoint.method.toUpperCase()} ${endpoint.path} rejects TEACHER role`, async () => {
        const app = buildApp();
        const token = makeAccessToken("user-1", "TEACHER");
        const res = await request(app)[endpoint.method](endpoint.path)
          .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });
    }
  });

  describe("authorization guard - ADMIN role denied (must be SUPER_ADMIN)", () => {
    for (const endpoint of adminEndpoints) {
      it(`${endpoint.method.toUpperCase()} ${endpoint.path} rejects ADMIN role`, async () => {
        const app = buildApp();
        const token = makeAccessToken("user-1", "ADMIN");
        const res = await request(app)[endpoint.method](endpoint.path)
          .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });
    }
  });

  describe("PATCH /v1/admin/users/:userId/status", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app)
        .patch("/v1/admin/users/user-1/status")
        .send({ status: "DISABLED" });
      expect(res.status).toBe(401);
    });

    it("rejects non-SUPER_ADMIN role", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "TEACHER");
      const res = await request(app)
        .patch("/v1/admin/users/user-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "DISABLED" });
      expect(res.status).toBe(403);
    });

    it("rejects invalid status value", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .patch("/v1/admin/users/user-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "INVALID_STATUS" });
      expect(res.status).toBe(400);
    });

    it("rejects empty body", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .patch("/v1/admin/users/user-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("rejects status change without reason", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .patch("/v1/admin/users/user-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "ACTIVE" });
      expect(res.status).toBe(400);
    });

    it("accepts valid status DISABLED with reason", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .patch("/v1/admin/users/user-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "DISABLED", reason: "violation of terms" });
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe("PATCH /v1/admin/subscriptions/:subscriptionId/status", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app)
        .patch("/v1/admin/subscriptions/sub-1/status")
        .send({ status: "CANCELED" });
      expect(res.status).toBe(401);
    });

    it("rejects non-SUPER_ADMIN role", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "ADMIN");
      const res = await request(app)
        .patch("/v1/admin/subscriptions/sub-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "CANCELED" });
      expect(res.status).toBe(403);
    });

    it("rejects invalid status", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .patch("/v1/admin/subscriptions/sub-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "TRIALING" }); // Not in allowed enum
      expect(res.status).toBe(400);
    });

    it("rejects subscription status change without reason", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .patch("/v1/admin/subscriptions/sub-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "CANCELED" });
      expect(res.status).toBe(400);
    });

    it("accepts valid CANCELED status with reason", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .patch("/v1/admin/subscriptions/sub-1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "CANCELED", reason: "fraud detected" });
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe("pagination validation", () => {
    it("accepts default pagination (no params)", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .get("/v1/admin/users")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).not.toBe(400);
    });

    it("accepts valid page and pageSize", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .get("/v1/admin/users?page=2&pageSize=50")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).not.toBe(400);
    });

    it("rejects pageSize > 100", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .get("/v1/admin/users?page=1&pageSize=101")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it("rejects page < 1", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .get("/v1/admin/users?page=0&pageSize=20")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it("rejects non-numeric page", async () => {
      const app = buildApp();
      const token = makeAccessToken("admin-1", "SUPER_ADMIN");
      const res = await request(app)
        .get("/v1/admin/users?page=abc")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });
});
