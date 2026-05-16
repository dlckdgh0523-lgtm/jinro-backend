import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { buildApp as BuildApp } from "../../src/app";
import { makeAccessToken, makeExpiredToken, makeTokenWithWrongSecret } from "../helpers/auth";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../../src/app"));
});

describe("auth integration", () => {
  describe("POST /v1/auth/student/signup", () => {
    it("rejects empty body", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/signup").send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid email format", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/signup").send({
        name: "Test",
        email: "not-an-email",
        password: "ValidPass123!",
        passwordConfirm: "ValidPass123!"
      });
      expect(res.status).toBe(400);
    });

    it("rejects password shorter than 8 chars", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/signup").send({
        name: "Test",
        email: "test@test.com",
        password: "short",
        passwordConfirm: "short"
      });
      expect(res.status).toBe(400);
    });

    it("rejects mismatched password confirmation", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/signup").send({
        name: "Test",
        email: "test@test.com",
        password: "ValidPassword123!",
        passwordConfirm: "DifferentPassword123!"
      });
      expect(res.status).toBe(400);
    });

    it("rejects missing name", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/signup").send({
        email: "test@test.com",
        password: "ValidPassword123!",
        passwordConfirm: "ValidPassword123!"
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/auth/teacher/signup", () => {
    it("rejects empty body", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/teacher/signup").send({});
      expect(res.status).toBe(400);
    });

    it("rejects missing required fields", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/teacher/signup").send({
        email: "teacher@test.com",
        password: "ValidPass123!"
      });
      expect(res.status).toBe(400);
    });

    it("rejects mismatched passwords", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/teacher/signup").send({
        schoolName: "Test School",
        name: "Teacher",
        email: "teacher@test.com",
        password: "ValidPass123!",
        passwordConfirm: "Different123!",
        grade: "1",
        classNum: "1"
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/auth/student/login", () => {
    it("rejects empty body", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/login").send({});
      expect(res.status).toBe(400);
    });

    it("rejects missing password", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/login").send({ email: "test@test.com" });
      expect(res.status).toBe(400);
    });

    it("rejects missing email", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/login").send({ password: "password123" });
      expect(res.status).toBe(400);
    });

    it("rejects invalid email format", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/student/login").send({
        email: "not-valid",
        password: "password123"
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/auth/teacher/login", () => {
    it("rejects empty body", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/teacher/login").send({});
      expect(res.status).toBe(400);
    });

    it("rejects invalid email", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/teacher/login").send({
        email: "bad",
        password: "password123"
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/auth/refresh", () => {
    it("rejects empty body (refreshToken required)", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/refresh").send({});
      expect(res.status).toBe(400);
    });

    it("rejects empty string refreshToken", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/refresh").send({ refreshToken: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/auth/logout", () => {
    it("rejects empty body (refreshToken required)", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/logout").send({});
      expect(res.status).toBe(400);
    });

    it("rejects empty string refreshToken", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/logout").send({ refreshToken: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/auth/invite/validate", () => {
    it("rejects empty body", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/invite/validate").send({});
      expect(res.status).toBe(400);
    });

    it("rejects empty inviteCode", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/invite/validate").send({ inviteCode: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /v1/auth/google", () => {
    it("returns state parameter and authUrl", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/auth/google");
      expect(res.status).toBe(200);
      expect(res.body.data.state).toBeDefined();
      expect(res.body.data.state).toHaveLength(36);
      expect(res.body.data.authUrl).toBeDefined();
      expect(res.body.data.authUrl).toContain("accounts.google.com");
    });
  });

  describe("POST /v1/auth/google/callback", () => {
    it("rejects missing code", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/google/callback").send({});
      expect(res.status).toBe(400);
    });

    it("rejects empty code", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/google/callback").send({ code: "" });
      expect(res.status).toBe(400);
    });

    it("rejects invalid redirectUri format", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/google/callback").send({
        code: "fake-code",
        redirectUri: "not-a-valid-url"
      });
      expect(res.status).toBe(400);
    });

    it("accepts valid redirectUri as optional", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/auth/google/callback").send({
        code: "fake-code",
        redirectUri: "http://localhost:5173/auth/google/callback"
      });
      // Passes validation, will fail at Google token exchange (500)
      expect(res.status).not.toBe(400);
    });
  });

  describe("authenticated endpoints require valid token", () => {
    it("rejects malformed bearer token on protected route", async () => {
      const app = buildApp();
      const res = await request(app)
        .get("/v1/me")
        .set("Authorization", "Bearer not.a.valid.jwt");
      expect(res.status).toBe(401);
    });

    it("rejects expired token", async () => {
      const app = buildApp();
      const token = makeExpiredToken("user-1");
      const res = await request(app)
        .get("/v1/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it("rejects token with wrong secret", async () => {
      const app = buildApp();
      const token = makeTokenWithWrongSecret("user-1");
      const res = await request(app)
        .get("/v1/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it("rejects missing Authorization header", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/me");
      expect(res.status).toBe(401);
    });

    it("rejects token without Bearer prefix", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1");
      const res = await request(app)
        .get("/v1/me")
        .set("Authorization", token);
      expect(res.status).toBe(401);
    });

    it("returns proper error format on auth failure", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/me");
      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: "AUTHENTICATION_ERROR",
          message: expect.any(String)
        },
        requestId: expect.any(String)
      });
    });
  });
});
