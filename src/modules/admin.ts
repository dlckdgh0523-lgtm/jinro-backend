import type { Router } from "express";
import { authenticate, authorize } from "../infra/security";
import type { AuthenticatedRequest } from "../infra/security";
import { asyncHandler, sendSuccess, makePagination } from "../common/http";
import { setAuditContext } from "../infra/audit";
import { adminService } from "./admin.service";
import { z } from "zod";
import { validate } from "../common/http";

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

const userStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED", "DELETED"]),
  reason: z.string().min(1, "Reason is required for admin mutations.")
});

const subscriptionStatusSchema = z.object({
  status: z.enum(["ACTIVE", "CANCELED", "EXPIRED", "PAYMENT_FAILED"]),
  reason: z.string().min(1, "Reason is required for admin mutations.")
});

export const registerAdminRoutes = (router: Router) => {
  const adminAuth = [authenticate, authorize("SUPER_ADMIN")];

  router.get(
    "/admin/overview",
    ...adminAuth,
    asyncHandler(async (req, res) => {
      const overview = await adminService.getOverview();
      sendSuccess(req, res, overview);
    })
  );

  router.get(
    "/admin/users",
    ...adminAuth,
    validate(paginationQuery, "query"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const { users, total } = await adminService.listUsers(page, pageSize);
      sendSuccess(req, res, users, { pagination: makePagination(page, pageSize, total) });
    })
  );

  router.get(
    "/admin/users/:userId",
    ...adminAuth,
    asyncHandler(async (req, res) => {
      const user = await adminService.getUserDetail(req.params.userId as string);
      sendSuccess(req, res, user);
    })
  );

  router.patch(
    "/admin/users/:userId/status",
    ...adminAuth,
    validate(userStatusSchema),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const user = await adminService.updateUserStatus(req.params.userId as string, req.body.status, req.body.reason);
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: auth!.sub,
        action: "ADMIN_USER_STATUS_CHANGE",
        resourceType: "user",
        resourceId: req.params.userId as string,
        afterJson: { status: req.body.status, reason: req.body.reason }
      });
      sendSuccess(req, res, user);
    })
  );

  router.get(
    "/admin/teachers",
    ...adminAuth,
    validate(paginationQuery, "query"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const { teachers, total } = await adminService.listTeachers(page, pageSize);
      sendSuccess(req, res, teachers, { pagination: makePagination(page, pageSize, total) });
    })
  );

  router.get(
    "/admin/students",
    ...adminAuth,
    validate(paginationQuery, "query"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const { students, total } = await adminService.listStudents(page, pageSize);
      sendSuccess(req, res, students, { pagination: makePagination(page, pageSize, total) });
    })
  );

  router.get(
    "/admin/classrooms",
    ...adminAuth,
    validate(paginationQuery, "query"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const { classrooms, total } = await adminService.listClassrooms(page, pageSize);
      sendSuccess(req, res, classrooms, { pagination: makePagination(page, pageSize, total) });
    })
  );

  router.get(
    "/admin/subscriptions",
    ...adminAuth,
    validate(paginationQuery, "query"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const { subscriptions, total } = await adminService.listSubscriptions(page, pageSize);
      sendSuccess(req, res, subscriptions, { pagination: makePagination(page, pageSize, total) });
    })
  );

  router.patch(
    "/admin/subscriptions/:subscriptionId/status",
    ...adminAuth,
    validate(subscriptionStatusSchema),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const result = await adminService.updateSubscriptionStatus(
        req.params.subscriptionId as string,
        req.body.status,
        req.body.reason
      );
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: auth!.sub,
        action: "ADMIN_SUBSCRIPTION_STATUS_CHANGE",
        resourceType: "subscription",
        resourceId: req.params.subscriptionId as string,
        afterJson: { status: req.body.status, reason: req.body.reason }
      });
      sendSuccess(req, res, result);
    })
  );

  router.get(
    "/admin/ai-usage",
    ...adminAuth,
    validate(paginationQuery, "query"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const { logs, total } = await adminService.listAiUsage(page, pageSize);
      sendSuccess(req, res, logs, { pagination: makePagination(page, pageSize, total) });
    })
  );

  router.get(
    "/admin/audit-logs",
    ...adminAuth,
    validate(paginationQuery, "query"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const { logs, total } = await adminService.listAuditLogs(page, pageSize);
      sendSuccess(req, res, logs, { pagination: makePagination(page, pageSize, total) });
    })
  );

  router.get(
    "/admin/system/health",
    ...adminAuth,
    asyncHandler(async (req, res) => {
      const health = await adminService.getSystemHealth();
      sendSuccess(req, res, health);
    })
  );
};
