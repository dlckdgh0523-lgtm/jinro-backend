import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import type { buildApp as BuildApp } from "../src/app";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../src/app"));
});

describe("auth routes", () => {
  describe("POST /v1/auth/student/login", () => {
    it("rejects missing fields with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/student/login")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid email format with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/student/login")
        .send({ email: "not-an-email", password: "password123" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /v1/auth/teacher/login", () => {
    it("rejects missing fields with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/teacher/login")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /v1/auth/student/signup", () => {
    it("rejects mismatched passwords with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/student/signup")
        .send({
          name: "Test",
          email: "test@example.com",
          password: "password123",
          passwordConfirm: "different123"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects short password with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/student/signup")
        .send({
          name: "Test",
          email: "test@example.com",
          password: "short",
          passwordConfirm: "short"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /v1/auth/teacher/signup", () => {
    it("rejects missing required fields with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/teacher/signup")
        .send({ email: "teacher@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /v1/auth/refresh", () => {
    it("rejects missing refreshToken with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/refresh")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /v1/auth/logout", () => {
    it("rejects missing refreshToken with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/logout")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /v1/auth/invite/validate", () => {
    it("rejects missing inviteCode with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/invite/validate")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /v1/auth/google", () => {
    it("returns authUrl and state when Google OAuth is configured", async () => {
      const app = buildApp();
      const response = await request(app)
        .get("/v1/auth/google")
        .set("Origin", "http://localhost:5173");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toContain("accounts.google.com");
      expect(response.body.data.state).toBeTruthy();
    });
  });

  describe("POST /v1/auth/google/callback", () => {
    it("rejects missing code with 400", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/auth/google/callback")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
