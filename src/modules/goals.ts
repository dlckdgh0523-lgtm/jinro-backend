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
};
