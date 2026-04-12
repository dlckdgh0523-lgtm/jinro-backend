import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "../common/http";
import { env } from "../config/env";

export type AppRole = "STUDENT" | "TEACHER" | "ADMIN";
export type TokenKind = "access" | "refresh" | "stream";

export interface AuthClaims {
  sub: string;
  role: AppRole;
  tokenKind: TokenKind;
  jti: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthClaims;
  requestId?: string;
}

const signToken = (
  payload: AuthClaims,
  secret: Secret,
  expiresIn: SignOptions["expiresIn"]
) =>
  jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn
  });

export const signAccessToken = (subject: string, role: AppRole) =>
  signToken(
    {
      sub: subject,
      role,
      tokenKind: "access",
      jti: randomUUID()
    },
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
  );

export const signRefreshToken = (subject: string, role: AppRole) =>
  signToken(
    {
      sub: subject,
      role,
      tokenKind: "refresh",
      jti: randomUUID()
    },
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]
  );

export const signStreamToken = (subject: string, role: AppRole) =>
  signToken(
    {
      sub: subject,
      role,
      tokenKind: "stream",
      jti: randomUUID()
    },
    env.JWT_STREAM_SECRET,
    env.JWT_STREAM_EXPIRES_IN as SignOptions["expiresIn"]
  );

const verifyToken = (token: string, kind: TokenKind): AuthClaims => {
  const secret =
    kind === "access"
      ? env.JWT_ACCESS_SECRET
      : kind === "refresh"
        ? env.JWT_REFRESH_SECRET
        : env.JWT_STREAM_SECRET;

  return jwt.verify(token, secret) as AuthClaims;
};

export const verifyAccessToken = (token: string) => verifyToken(token, "access");
export const verifyRefreshToken = (token: string) => verifyToken(token, "refresh");
export const verifyStreamToken = (token: string) => verifyToken(token, "stream");

export const hashPassword = (rawPassword: string) => bcrypt.hash(rawPassword, 12);
export const verifyPassword = (rawPassword: string, passwordHash: string) =>
  bcrypt.compare(rawPassword, passwordHash);

export const hashOpaqueToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const resolveBearerToken = (req: Request) => {
  const headerName = env.ACCESS_TOKEN_HEADER_NAME.toLowerCase();
  const rawHeader = req.headers[headerName];
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (headerValue?.startsWith("Bearer ")) {
    return headerValue.slice("Bearer ".length).trim();
  }

  return null;
};

export const authenticate: RequestHandler = (req, _res: Response, next: NextFunction) => {
  const request = req as AuthenticatedRequest;
  const bearerToken = resolveBearerToken(req);
  const streamToken =
    typeof req.query.streamToken === "string" ? req.query.streamToken : null;

  const token = bearerToken ?? streamToken;

  if (!token) {
    return next(new ApiError(401, "AUTHENTICATION_ERROR", "Authentication token is missing."));
  }

  try {
    request.auth = bearerToken ? verifyAccessToken(token) : verifyStreamToken(token);
    return next();
  } catch {
    return next(new ApiError(401, "AUTHENTICATION_ERROR", "Authentication token is invalid."));
  }
};

export const authorize =
  (...roles: AppRole[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const request = req as AuthenticatedRequest;
    if (!request.auth) {
      return next(new ApiError(401, "AUTHENTICATION_ERROR", "Authentication required."));
    }

    if (!roles.includes(request.auth.role)) {
      return next(new ApiError(403, "FORBIDDEN", "Insufficient role privileges."));
    }

    return next();
  };
