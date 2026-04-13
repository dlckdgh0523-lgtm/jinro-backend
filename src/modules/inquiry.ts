import type { Router } from "express";
import { z } from "zod";
import { setAuditContext } from "../infra/audit";
import { prisma } from "../infra/prisma";
import { authenticate, type AuthenticatedRequest } from "../infra/security";
import { ApiError, asyncHandler, sendSuccess, validate } from "../common/http";

const createInquirySchema = z.object({
  subject: z.string().min(1).max(200),
  content: z.string().min(1).max(2000)
});

export const registerInquiryRoutes = (router: Router) => {
  router.post(
    "/inquiries",
    authenticate,
    validate(createInquirySchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const inquiry = await prisma.inquiry.create({
        data: {
          userId: req.auth!.sub,
          subject: req.body.subject,
          content: req.body.content
        }
      });

      setAuditContext(req, {
        action: "INQUIRY_CREATE",
        resourceType: "inquiry",
        resourceId: inquiry.id,
        afterJson: { subject: inquiry.subject }
      });

      sendSuccess(req, res, {
        id: inquiry.id,
        subject: inquiry.subject,
        status: inquiry.status.toLowerCase(),
        createdAt: inquiry.createdAt.toISOString()
      });
    })
  );

  router.get(
    "/inquiries",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const inquiries = await prisma.inquiry.findMany({
        where: { userId: req.auth!.sub },
        orderBy: { createdAt: "desc" },
        take: 50
      });

      sendSuccess(
        req,
        res,
        inquiries.map((item) => ({
          id: item.id,
          subject: item.subject,
          content: item.content,
          status: item.status.toLowerCase(),
          adminReply: item.adminReply ?? null,
          repliedAt: item.repliedAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString()
        }))
      );
    })
  );

  router.get(
    "/inquiries/:inquiryId",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const inquiryId = Array.isArray(req.params.inquiryId) ? req.params.inquiryId[0] : req.params.inquiryId;
      const inquiry = await prisma.inquiry.findUnique({
        where: { id: inquiryId }
      });

      if (!inquiry || inquiry.userId !== req.auth!.sub) {
        throw new ApiError(404, "NOT_FOUND", "Inquiry not found.");
      }

      sendSuccess(req, res, {
        id: inquiry.id,
        subject: inquiry.subject,
        content: inquiry.content,
        status: inquiry.status.toLowerCase(),
        adminReply: inquiry.adminReply ?? null,
        repliedAt: inquiry.repliedAt?.toISOString() ?? null,
        createdAt: inquiry.createdAt.toISOString()
      });
    })
  );
};
