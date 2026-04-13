import type { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { goalService } from "./goals.service";
import { goalQuerySchema, saveGoalSchema } from "./goals.validator";

export const registerGoalRoutes = (router: Router) => {
  router.get(
    "/goals/current",
    authenticate,
    validate(goalQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await goalService.getCurrent(req, req.query));
    })
  );

  router.put(
    "/goals/current",
    authenticate,
    validate(saveGoalSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await goalService.saveCurrent(req, req.body));
    })
  );

  router.delete(
    "/goals/current",
    authenticate,
    validate(goalQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await goalService.deleteCurrent(req, req.query));
    })
  );

  router.get(
    "/goals/options",
    authenticate,
    asyncHandler(async (req, res) => {
      sendSuccess(req, res, await goalService.listOptions());
    })
  );

  router.get(
    "/goals/universities",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const region = req.query.region ? String(req.query.region) : undefined;
      const universities = await goalService.listUniversities(region);
      sendSuccess(req, res, universities);
    })
  );

  router.get(
    "/goals/departments",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const universityId = req.query.universityId ? String(req.query.universityId) : undefined;
      if (!universityId) {
        return sendSuccess(req, res, [], {}, 400);
      }
      const departments = await goalService.listDepartmentsByUniversity(universityId);
      sendSuccess(req, res, departments);
    })
  );
};
