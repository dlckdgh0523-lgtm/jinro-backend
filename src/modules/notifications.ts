import type { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { notificationService } from "./notifications.service";
import { notificationListSchema, notificationParamsSchema } from "./notifications.validator";

export const registerNotificationRoutes = (router: Router) => {
  router.get(
    "/notifications",
    authenticate,
    validate(notificationListSchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const result = await notificationService.list(req, req.query as unknown as {
        page: number;
        pageSize: number;
        tab: "all" | "unread" | "important";
      });
      sendSuccess(req, res, result.data, result.meta);
    })
  );

  router.patch(
    "/notifications/:notificationId/read",
    authenticate,
    validate(notificationParamsSchema, "params"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await notificationService.markRead(req, req.params.notificationId as string));
    })
  );

  router.patch(
    "/notifications/read-all",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await notificationService.readAll(req));
    })
  );

  router.get(
    "/sse/token",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, notificationService.issueStreamToken(req));
    })
  );

  router.get(
    "/sse/stream",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      notificationService.openStream(req, res);
    })
  );
};
