import type { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { gradeService } from "./grades.service";
import {
  examSaveSchema,
  gradeQuerySchema,
  mockExamSaveSchema,
  semesterFinalSaveSchema
} from "./grades.validator";

export const registerGradeRoutes = (router: Router) => {
  router.post(
    "/grades/exams",
    authenticate,
    validate(examSaveSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await gradeService.saveExamRecords(req, req.body));
    })
  );

  router.post(
    "/semester-finals",
    authenticate,
    validate(semesterFinalSaveSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await gradeService.saveSemesterFinals(req, req.body));
    })
  );

  router.post(
    "/mock-exams",
    authenticate,
    validate(mockExamSaveSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await gradeService.saveMockExamResults(req, req.body));
    })
  );

  router.get(
    "/grades/chart",
    authenticate,
    validate(gradeQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(
        req,
        res,
        await gradeService.getChart(req, req.query as { mode: "final" | "exam" | "practice"; studentId?: string })
      );
    })
  );

  router.get(
    "/growth-report",
    authenticate,
    validate(gradeQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(
        req,
        res,
        await gradeService.getGrowthReport(
          req,
          req.query as { mode: "final" | "exam" | "practice"; studentId?: string }
        )
      );
    })
  );
};
