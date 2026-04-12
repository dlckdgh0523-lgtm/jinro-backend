import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import type { buildApp as BuildApp } from "../src/app";

let buildApp: typeof BuildApp;

beforeAll(async () => {
  ({ buildApp } = await import("../src/app"));
});

describe("health routes", () => {
  it("returns application health", async () => {
    const app = buildApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.timestamp).toEqual(expect.any(String));
  });
});
