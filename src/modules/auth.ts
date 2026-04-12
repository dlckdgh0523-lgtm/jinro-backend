import type { Response, Router } from "express";
import type { AppRole } from "../infra/security";
import { env } from "../config/env";
import { setAuditContext } from "../infra/audit";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { hashOpaqueToken } from "../infra/security";
import {
  inviteValidationSchema,
  loginSchema,
  refreshSchema,
  studentSignupSchema,
  teacherSignupSchema
} from "./auth.validator";
import { authService } from "./auth.service";

const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const attachRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/v1/auth",
    maxAge: REFRESH_TOKEN_TTL_MS
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
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
};
