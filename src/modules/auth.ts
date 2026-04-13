import type { Request, Response, Router } from "express";
import type { AppRole } from "../infra/security";
import { env } from "../config/env";
import { setAuditContext } from "../infra/audit";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { hashOpaqueToken } from "../infra/security";
import {
  inviteValidationSchema,
  loginSchema,
  refreshSchema,
  googleCallbackSchema,
  studentSignupSchema,
  teacherSignupSchema
} from "./auth.validator";
import { authService } from "./auth.service";
import { OAuth2Client } from "google-auth-library";

const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const FRONTEND_GOOGLE_CALLBACK_PATH = "/auth/google/callback";

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, "");

const resolveGoogleCallbackUrl = (req: Request) => {
  const originHeader = req.get("origin");
  if (originHeader && env.corsOrigins.includes(originHeader)) {
    return `${normalizeOrigin(originHeader)}${FRONTEND_GOOGLE_CALLBACK_PATH}`;
  }

  const refererHeader = req.get("referer");
  if (refererHeader) {
    try {
      const refererOrigin = new URL(refererHeader).origin;
      if (env.corsOrigins.includes(refererOrigin)) {
        return `${normalizeOrigin(refererOrigin)}${FRONTEND_GOOGLE_CALLBACK_PATH}`;
      }
    } catch {
      // Ignore invalid referer headers and fall back to configured callback URL.
    }
  }

  return env.GOOGLE_CALLBACK_URL || "";
};

const attachRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/v1/auth",
    maxAge: REFRESH_TOKEN_TTL_MS
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/v1/auth"
  });
};

export const registerAuthRoutes = (router: Router) => {
  router.post(
    "/auth/student/login",
    validate(loginSchema),
    asyncHandler(async (req, res) => {
      const session = await authService.login(req.body, "STUDENT" as AppRole);
      attachRefreshTokenCookie(res, session.refreshToken);
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: session.user.id,
        action: "AUTH_STUDENT_LOGIN",
        resourceType: "session",
        resourceId: session.user.id,
        afterJson: {
          role: session.user.role
        }
      });
      sendSuccess(req, res, session);
    })
  );

  router.post(
    "/auth/teacher/login",
    validate(loginSchema),
    asyncHandler(async (req, res) => {
      const session = await authService.login(req.body, "TEACHER" as AppRole);
      attachRefreshTokenCookie(res, session.refreshToken);
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: session.user.id,
        action: "AUTH_TEACHER_LOGIN",
        resourceType: "session",
        resourceId: session.user.id,
        afterJson: {
          role: session.user.role
        }
      });
      sendSuccess(req, res, session);
    })
  );

  router.post(
    "/auth/student/signup",
    validate(studentSignupSchema),
    asyncHandler(async (req, res) => {
      const session = await authService.signupStudent(req.body);
      attachRefreshTokenCookie(res, session.refreshToken);
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: session.user.id,
        action: "AUTH_STUDENT_SIGNUP",
        resourceType: "user",
        resourceId: session.user.id,
        afterJson: {
          role: session.user.role,
          email: session.user.email
        }
      });
      sendSuccess(req, res, session, undefined, 201);
    })
  );

  router.post(
    "/auth/teacher/signup",
    validate(teacherSignupSchema),
    asyncHandler(async (req, res) => {
      const session = await authService.signupTeacher(req.body);
      attachRefreshTokenCookie(res, session.refreshToken);
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: session.user.id,
        action: "AUTH_TEACHER_SIGNUP",
        resourceType: "user",
        resourceId: session.user.id,
        afterJson: {
          role: session.user.role,
          email: session.user.email
        }
      });
      sendSuccess(req, res, session, undefined, 201);
    })
  );

  router.post(
    "/auth/refresh",
    validate(refreshSchema),
    asyncHandler(async (req, res) => {
      const session = await authService.refresh(req.body.refreshToken);
      attachRefreshTokenCookie(res, session.refreshToken);
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: session.user.id,
        action: "AUTH_REFRESH",
        resourceType: "session",
        resourceId: session.user.id,
        afterJson: {
          role: session.user.role
        }
      });
      sendSuccess(req, res, session);
    })
  );

  router.post(
    "/auth/logout",
    validate(refreshSchema),
    asyncHandler(async (req, res) => {
      await authService.logout(req.body.refreshToken);
      clearRefreshTokenCookie(res);
      setAuditContext(req, {
        action: "AUTH_LOGOUT",
        resourceType: "session",
        resourceId: hashOpaqueToken(req.body.refreshToken)
      });
      sendSuccess(req, res, { loggedOut: true });
    })
  );

  router.post(
    "/auth/invite/validate",
    validate(inviteValidationSchema),
    asyncHandler(async (req, res) => {
      sendSuccess(req, res, await authService.validateInvite(req.body));
    })
  );

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    router.get(
      "/auth/google",
      asyncHandler(async (req, res) => {
        const redirectUri = resolveGoogleCallbackUrl(req);
        const oauth2Client = new OAuth2Client({
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          redirectUri
        });

        const authorizeUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: ["openid", "email", "profile"]
        });

        sendSuccess(req, res, {
          authUrl: authorizeUrl
        });
      })
    );

    router.get(
      "/auth/google/callback",
      validate(googleCallbackSchema, "query"),
      asyncHandler(async (req, res) => {
        const { code, state } = req.query as { code: string; state: string };
        const redirectUri = resolveGoogleCallbackUrl(req);
        const requestLogger = (
          req as unknown as Request & {
            log?: {
              warn: (payload: unknown, message?: string) => void;
            };
          }
        ).log;

        if (env.GOOGLE_CALLBACK_URL && redirectUri && env.GOOGLE_CALLBACK_URL !== redirectUri) {
          requestLogger?.warn(
            {
              requestId: req.headers["x-request-id"],
              configuredRedirectUri: env.GOOGLE_CALLBACK_URL,
              resolvedRedirectUri: redirectUri
            },
            "google callback url mismatch detected"
          );
        }

        const session = await authService.handleGoogleCallback({ code, state, redirectUri });

        attachRefreshTokenCookie(res, session.refreshToken);
        setAuditContext(req, {
          actorType: "USER",
          actorUserId: session.user.id,
          action: "AUTH_GOOGLE_LOGIN",
          resourceType: "session",
          resourceId: session.user.id,
          afterJson: {
            role: session.user.role,
            authProvider: "GOOGLE"
          }
        });

        sendSuccess(req, res, session);
      })
    );
  }
};
