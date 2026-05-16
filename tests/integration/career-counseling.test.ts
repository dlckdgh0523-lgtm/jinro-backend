import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { buildApp as BuildApp } from "../../src/app";
import { makeAccessToken, makeExpiredToken } from "../helpers/auth";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../../src/app"));
});

describe("career-counseling integration", () => {
  describe("POST /v1/career-counseling/sessions", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/career-counseling/sessions").send({});
      expect(res.status).toBe(401);
    });

    it("rejects expired token", async () => {
      const app = buildApp();
      const token = makeExpiredToken("user-1");
      const res = await request(app)
        .post("/v1/career-counseling/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(401);
    });

    it("rejects non-STUDENT role", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "TEACHER");
      const res = await request(app)
        .post("/v1/career-counseling/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it("accepts request with title", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "STUDENT");
      const res = await request(app)
        .post("/v1/career-counseling/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "내 진로 상담" });
      // Passes validation/auth - fails at DB lookup for student profile
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("accepts request without title (optional field)", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "STUDENT");
      const res = await request(app)
        .post("/v1/career-counseling/sessions")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).not.toBe(400);
    });
  });

  describe("GET /v1/career-counseling/sessions", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/career-counseling/sessions");
      expect(res.status).toBe(401);
    });

    it("rejects non-STUDENT role", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "TEACHER");
      const res = await request(app)
        .get("/v1/career-counseling/sessions")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /v1/career-counseling/sessions/:sessionId", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/career-counseling/sessions/session-123");
      expect(res.status).toBe(401);
    });

    it("rejects non-STUDENT role", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "TEACHER");
      const res = await request(app)
        .get("/v1/career-counseling/sessions/session-123")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /v1/career-counseling/sessions/:sessionId/messages", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/v1/career-counseling/sessions/session-123/messages")
        .send({ content: "hello" });
      expect(res.status).toBe(401);
    });

    it("rejects empty content", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "STUDENT");
      const res = await request(app)
        .post("/v1/career-counseling/sessions/session-123/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "" });
      expect(res.status).toBe(400);
    });

    it("rejects missing content field", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "STUDENT");
      const res = await request(app)
        .post("/v1/career-counseling/sessions/session-123/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("rejects content exceeding 2000 chars", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "STUDENT");
      const res = await request(app)
        .post("/v1/career-counseling/sessions/session-123/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "x".repeat(2001) });
      expect(res.status).toBe(400);
    });

    it("accepts valid message content", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "STUDENT");
      const res = await request(app)
        .post("/v1/career-counseling/sessions/session-123/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "수학을 좋아해요" });
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
    });

    it("accepts maximum length message (2000 chars)", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "STUDENT");
      const res = await request(app)
        .post("/v1/career-counseling/sessions/session-123/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "가".repeat(2000) });
      expect(res.status).not.toBe(400);
    });
  });

  describe("POST /v1/career-counseling/sessions/:sessionId/report", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).post("/v1/career-counseling/sessions/s1/report");
      expect(res.status).toBe(401);
    });

    it("rejects non-STUDENT role", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "TEACHER");
      const res = await request(app)
        .post("/v1/career-counseling/sessions/s1/report")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /v1/career-counseling/sessions/:sessionId/report", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const res = await request(app).get("/v1/career-counseling/sessions/s1/report");
      expect(res.status).toBe(401);
    });

    it("rejects non-STUDENT role", async () => {
      const app = buildApp();
      const token = makeAccessToken("user-1", "TEACHER");
      const res = await request(app)
        .get("/v1/career-counseling/sessions/s1/report")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });
});
