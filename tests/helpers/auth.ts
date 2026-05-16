import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AppRole } from "../../src/infra/security";

const ACCESS_SECRET = "test-access-secret-should-be-at-least-32-chars";
const STREAM_SECRET = "test-stream-secret-should-be-at-least-32-chars";

export function makeAccessToken(sub: string, role: AppRole = "STUDENT") {
  return jwt.sign(
    { sub, role, tokenKind: "access", jti: randomUUID() },
    ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: "15m" }
  );
}

export function makeExpiredToken(sub: string, role: AppRole = "STUDENT") {
  return jwt.sign(
    { sub, role, tokenKind: "access", jti: randomUUID() },
    ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: "-1s" }
  );
}

export function makeStreamToken(sub: string, role: AppRole = "STUDENT") {
  return jwt.sign(
    { sub, role, tokenKind: "stream", jti: randomUUID() },
    STREAM_SECRET,
    { algorithm: "HS256", expiresIn: "60s" }
  );
}

export function makeTokenWithWrongSecret(sub: string, role: AppRole = "STUDENT") {
  return jwt.sign(
    { sub, role, tokenKind: "access", jti: randomUUID() },
    "wrong-secret-that-is-at-least-32-characters-long",
    { algorithm: "HS256", expiresIn: "15m" }
  );
}
