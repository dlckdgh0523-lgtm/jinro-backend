import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import type { buildApp as BuildApp } from "../src/app";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../src/app"));
});

describe("career counseling routes", () => {
  describe("POST /v1/career-counseling/sessions", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/career-counseling/sessions")
        .send({});
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/career-counseling/sessions", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/career-counseling/sessions");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/career-counseling/sessions/:sessionId", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app).get("/v1/career-counseling/sessions/some-id");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /v1/career-counseling/sessions/:sessionId/messages", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/career-counseling/sessions/some-id/messages")
        .send({ content: "test" });
      expect(response.status).toBe(401);
    });
  });

  describe("POST /v1/career-counseling/sessions/:sessionId/report", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app)
        .post("/v1/career-counseling/sessions/some-id/report");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/career-counseling/sessions/:sessionId/report", () => {
    it("rejects unauthenticated request", async () => {
      const app = buildApp();
      const response = await request(app)
        .get("/v1/career-counseling/sessions/some-id/report");
      expect(response.status).toBe(401);
    });
  });
});
