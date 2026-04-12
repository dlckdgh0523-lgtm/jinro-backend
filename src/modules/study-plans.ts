import type { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../infra/security";
import { ApiError, asyncHandler, sendSuccess, validate } from "../common/http";
import {
  createTaskSchema,
  studyPlanQuerySchema,
  taskParamsSchema,
  updateTaskSchema
} from "./study-plans.validator";
import { studyPlanService } from "./study-plans.service";

export const registerStudyPlanRoutes = (router: Router) => {
  router.get(
    "/study-plans/current",
    authenticate,
    validate(studyPlanQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(
        req,
        res,
        await studyPlanService.getCurrentPlan(
          req,
          typeof req.query.studentId === "string" ? req.query.studentId : undefined
        )
      );
    })
  );

  router.post(
    "/study-plans/current/tasks",
    authenticate,
    validate(createTaskSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await studyPlanService.createTask(req, req.body), undefined, 201);
    })
  );

  router.patch(
    "/study-plans/current/tasks/:taskId",
    authenticate,
    validate(taskParamsSchema, "params"),
    validate(updateTaskSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const taskId = typeof req.params.taskId === "string" ? req.params.taskId : undefined;
      if (!taskId) {
        throw new ApiError(400, "VALIDATION_ERROR", "Task id is required.");
      }

      sendSuccess(req, res, await studyPlanService.updateTask(req, taskId, req.body));
    })
  );

  router.delete(
    "/study-plans/current/tasks/:taskId",
    authenticate,
    validate(taskParamsSchema, "params"),
    validate(studyPlanQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const taskId = typeof req.params.taskId === "string" ? req.params.taskId : undefined;
      if (!taskId) {
        throw new ApiError(400, "VALIDATION_ERROR", "Task id is required.");
      }

      sendSuccess(
        req,
        res,
        await studyPlanService.deleteTask(
          req,
          taskId,
          typeof req.query.studentId === "string" ? req.query.studentId : undefined
        )
      );
    })
  );
};
