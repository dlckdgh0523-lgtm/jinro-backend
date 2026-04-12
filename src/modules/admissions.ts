import type { Router } from "express";
import { authenticate } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { admissionService } from "./admissions.service";
import { admissionsQuerySchema } from "./admissions.validator";

export const registerAdmissionRoutes = (router: Router) => {
  router.get(
    "/admissions",
    authenticate,
    validate(admissionsQuerySchema, "query"),
    asyncHandler(async (req, res) => {
      const result = await admissionService.list(req.query as unknown as {
        search?: string;
        year?: number;
        type?: "수시" | "정시";
        category?: "학생부교과" | "학생부종합" | "논술" | "수능위주" | "실기/실적";
        region?: string;
        page: number;
        pageSize: number;
      });
      sendSuccess(req, res, result.data, result.meta);
    })
  );
};
