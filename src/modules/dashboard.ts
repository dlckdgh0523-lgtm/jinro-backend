import type { Router } from "express";
import { authenticate, authorize, type AuthenticatedRequest } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { dashboardService } from "./dashboard.service";
import { studentListQuerySchema, studentParamsSchema } from "./dashboard.validator";

export const registerDashboardRoutes = (router: Router) => {
  router.get(
    "/students",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    validate(studentListQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await dashboardService.listStudents(req, req.query));
    })
  );

  router.get(
    "/students/:studentId",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    validate(studentParamsSchema, "params"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await dashboardService.getStudentDetail(req, req.params.studentId as string));
    })
  );

  router.get(
    "/teachers/me",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await dashboardService.getTeacherMe(req));
    })
  );

  router.get(
    "/classrooms/me",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await dashboardService.getClassroom(req));
    })
  );

  router.get(
    "/student/dashboard",
    authenticate,
    authorize("STUDENT"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await dashboardService.getStudentDashboard(req));
    })
  );

  router.get(
    "/teacher/dashboard",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await dashboardService.getTeacherDashboard(req));
    })
  );

  router.get(
    "/completion-status",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await dashboardService.getCompletionStatus(req));
    })
  );
};
