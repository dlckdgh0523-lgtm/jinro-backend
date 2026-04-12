import type { Router } from "express";
import { authenticate, authorize, type AuthenticatedRequest } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { counselingService } from "./counseling.service";
import {
  createMemoSchema,
  createRequestSchema,
  memoParamsSchema,
  memoQuerySchema,
  requestParamsSchema,
  requestQuerySchema,
  updateMemoSchema,
  updateRequestStatusSchema
} from "./counseling.validator";

export const registerCounselingRoutes = (router: Router) => {
  router.get(
    "/counseling/requests",
    authenticate,
    validate(requestQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await counselingService.listRequests(req, req.query));
    })
  );

  router.post(
    "/counseling/requests",
    authenticate,
    authorize("STUDENT"),
    validate(createRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await counselingService.createRequest(req, req.body), undefined, 201);
    })
  );

  router.patch(
    "/counseling/requests/:requestId/status",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    validate(requestParamsSchema, "params"),
    validate(updateRequestStatusSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(
        req,
        res,
        await counselingService.updateRequestStatus(req, req.params.requestId as string, req.body)
      );
    })
  );

  router.get(
    "/counseling/memos",
    authenticate,
    validate(memoQuerySchema, "query"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await counselingService.listMemos(req, req.query));
    })
  );

  router.post(
    "/counseling/memos",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    validate(createMemoSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await counselingService.createMemo(req, req.body), undefined, 201);
    })
  );

  router.patch(
    "/counseling/memos/:memoId",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    validate(memoParamsSchema, "params"),
    validate(updateMemoSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await counselingService.updateMemo(req, req.params.memoId as string, req.body));
    })
  );

  router.delete(
    "/counseling/memos/:memoId",
    authenticate,
    authorize("TEACHER", "ADMIN"),
    validate(memoParamsSchema, "params"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      sendSuccess(req, res, await counselingService.deleteMemo(req, req.params.memoId as string));
    })
  );
};
