import { beforeAll, describe, expect, it } from "vitest";

let signAccessToken: typeof import("../../src/infra/security").signAccessToken;
let signRefreshToken: typeof import("../../src/infra/security").signRefreshToken;
let signStreamToken: typeof import("../../src/infra/security").signStreamToken;
let verifyAccessToken: typeof import("../../src/infra/security").verifyAccessToken;
let verifyRefreshToken: typeof import("../../src/infra/security").verifyRefreshToken;
let verifyStreamToken: typeof import("../../src/infra/security").verifyStreamToken;
let hashPassword: typeof import("../../src/infra/security").hashPassword;
let verifyPassword: typeof import("../../src/infra/security").verifyPassword;
let hashOpaqueToken: typeof import("../../src/infra/security").hashOpaqueToken;

beforeAll(async () => {
  const mod = await import("../../src/infra/security");
  signAccessToken = mod.signAccessToken;
  signRefreshToken = mod.signRefreshToken;
  signStreamToken = mod.signStreamToken;
  verifyAccessToken = mod.verifyAccessToken;
  verifyRefreshToken = mod.verifyRefreshToken;
  verifyStreamToken = mod.verifyStreamToken;
  hashPassword = mod.hashPassword;
  verifyPassword = mod.verifyPassword;
  hashOpaqueToken = mod.hashOpaqueToken;
});

describe("JWT tokens", () => {
  describe("signAccessToken / verifyAccessToken", () => {
    it("creates verifiable access token", () => {
      const token = signAccessToken("user-123", "STUDENT");
      const claims = verifyAccessToken(token);
      expect(claims.sub).toBe("user-123");
      expect(claims.role).toBe("STUDENT");
      expect(claims.tokenKind).toBe("access");
      expect(claims.jti).toBeDefined();
    });

    it("works with different roles", () => {
      const roles = ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
      for (const role of roles) {
        const token = signAccessToken("user-1", role);
        const claims = verifyAccessToken(token);
        expect(claims.role).toBe(role);
      }
    });

    it("generates unique jti for each token", () => {
      const t1 = signAccessToken("user-1", "STUDENT");
      const t2 = signAccessToken("user-1", "STUDENT");
      const c1 = verifyAccessToken(t1);
      const c2 = verifyAccessToken(t2);
      expect(c1.jti).not.toBe(c2.jti);
    });

    it("cannot verify access token with refresh verifier", () => {
      const token = signAccessToken("user-1", "STUDENT");
      expect(() => verifyRefreshToken(token)).toThrow();
    });

    it("cannot verify access token with stream verifier", () => {
      const token = signAccessToken("user-1", "STUDENT");
      expect(() => verifyStreamToken(token)).toThrow();
    });
  });

  describe("signRefreshToken / verifyRefreshToken", () => {
    it("creates verifiable refresh token", () => {
      const token = signRefreshToken("user-123", "TEACHER");
      const claims = verifyRefreshToken(token);
      expect(claims.sub).toBe("user-123");
      expect(claims.role).toBe("TEACHER");
      expect(claims.tokenKind).toBe("refresh");
    });

    it("cannot be verified as access token", () => {
      const token = signRefreshToken("user-1", "STUDENT");
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });

  describe("signStreamToken / verifyStreamToken", () => {
    it("creates verifiable stream token", () => {
      const token = signStreamToken("user-123", "STUDENT");
      const claims = verifyStreamToken(token);
      expect(claims.sub).toBe("user-123");
      expect(claims.tokenKind).toBe("stream");
    });

    it("cannot be verified as access token", () => {
      const token = signStreamToken("user-1", "STUDENT");
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });
});

describe("password hashing", () => {
  it("hashes and verifies password correctly", async () => {
    const hash = await hashPassword("MySecretPass123!");
    const valid = await verifyPassword("MySecretPass123!", hash);
    expect(valid).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("CorrectPassword");
    const valid = await verifyPassword("WrongPassword", hash);
    expect(valid).toBe(false);
  });

  it("produces different hashes for same password (salt)", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });

  it("hash is not the plaintext", async () => {
    const password = "TestPass123";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password);
  });
});

describe("hashOpaqueToken", () => {
  it("produces consistent hash for same input", () => {
    const h1 = hashOpaqueToken("token-123");
    const h2 = hashOpaqueToken("token-123");
    expect(h1).toBe(h2);
  });

  it("produces different hash for different input", () => {
    const h1 = hashOpaqueToken("token-1");
    const h2 = hashOpaqueToken("token-2");
    expect(h1).not.toBe(h2);
  });

  it("produces hex string", () => {
    const hash = hashOpaqueToken("test");
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("produces 64-char SHA-256 hash", () => {
    const hash = hashOpaqueToken("test");
    expect(hash).toHaveLength(64);
  });
});
