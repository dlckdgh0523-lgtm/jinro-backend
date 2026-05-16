import type { Router } from "express";
import { authenticate, authorize } from "../infra/security";
import type { AuthenticatedRequest } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { ApiError } from "../common/http";
import { createSessionSchema, sendMessageSchema } from "./career-counseling.validator";
import { careerCounselingService } from "./career-counseling.service";
import { prisma } from "../infra/prisma";

const resolveStudentProfileId = async (userId: string) => {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new ApiError(403, "FORBIDDEN", "Student profile required.");
  return profile.id;
};

export const registerCareerCounselingRoutes = (router: Router) => {
  router.post(
    "/career-counseling/sessions",
    authenticate,
    authorize("STUDENT"),
    validate(createSessionSchema),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const studentProfileId = await resolveStudentProfileId(auth!.sub);
      const result = await careerCounselingService.createSession(auth!.sub, studentProfileId, req.body);
      sendSuccess(req, res, result, undefined, 201);
    })
  );

  router.get(
    "/career-counseling/sessions",
    authenticate,
    authorize("STUDENT"),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const studentProfileId = await resolveStudentProfileId(auth!.sub);
      const sessions = await careerCounselingService.listSessions(studentProfileId);
      sendSuccess(req, res, sessions);
    })
  );

  router.get(
    "/career-counseling/sessions/:sessionId",
    authenticate,
    authorize("STUDENT"),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const studentProfileId = await resolveStudentProfileId(auth!.sub);
      const session = await careerCounselingService.getSession(req.params.sessionId as string, studentProfileId);
      sendSuccess(req, res, session);
    })
  );

  router.post(
    "/career-counseling/sessions/:sessionId/messages",
    authenticate,
    authorize("STUDENT"),
    validate(sendMessageSchema),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const studentProfileId = await resolveStudentProfileId(auth!.sub);
      const result = await careerCounselingService.sendMessage(
        auth!.sub,
        req.params.sessionId as string,
        studentProfileId,
        req.body
      );
      sendSuccess(req, res, result);
    })
  );

  router.post(
    "/career-counseling/sessions/:sessionId/report",
    authenticate,
    authorize("STUDENT"),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const studentProfileId = await resolveStudentProfileId(auth!.sub);
      const report = await careerCounselingService.generateReport(auth!.sub, req.params.sessionId as string, studentProfileId);
      sendSuccess(req, res, report);
    })
  );

  router.get(
    "/career-counseling/sessions/:sessionId/report",
    authenticate,
    authorize("STUDENT"),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const studentProfileId = await resolveStudentProfileId(auth!.sub);
      const report = await careerCounselingService.getReport(req.params.sessionId as string, studentProfileId);
      sendSuccess(req, res, report);
    })
  );

  router.get(
    "/career-counseling/teacher/students/:studentProfileId/sessions",
    authenticate,
    authorize("TEACHER"),
    asyncHandler(async (req, res) => {
      const sessions = await careerCounselingService.listSessions(req.params.studentProfileId as string);
      sendSuccess(req, res, sessions);
    })
  );

  router.get(
    "/career-counseling/teacher/sessions/:sessionId/report",
    authenticate,
    authorize("TEACHER"),
    asyncHandler(async (req, res) => {
      const report = await careerCounselingService.getReport(req.params.sessionId as string, req.params.sessionId as string);
      sendSuccess(req, res, report);
    })
  );
};
