import type { Router } from "express";
import { z } from "zod";
import { setAuditContext } from "../infra/audit";
import { prisma } from "../infra/prisma";
import { authenticate, type AuthenticatedRequest, signStreamToken } from "../infra/security";
import { ApiError, asyncHandler, sendSuccess, validate } from "../common/http";
import { dbTrackToFront, frontTrackToDb } from "../common/domain";

const updateMeSchema = z.object({
  email: z.string().email().optional(),
  schoolName: z.string().min(1).optional(),
  track: z.string().optional()
});

export const registerMeRoutes = (router: Router) => {
  router.get(
    "/me",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const user = await prisma.user.findUnique({
        where: { id: req.auth!.sub },
        include: {
          studentProfile: {
            include: {
              goalSettings: {
                where: { isActive: true },
                orderBy: { updatedAt: "desc" },
                take: 1
              }
            }
          },
          teacherProfile: {
            include: {
              homeroomClassRooms: {
                where: { deletedAt: null },
                orderBy: { updatedAt: "desc" },
                take: 1
              }
            }
          },
          notifications: {
            where: { status: "UNREAD" }
          }
        }
      });

      if (!user) {
        throw new ApiError(404, "NOT_FOUND", "User not found.");
      }

      sendSuccess(req, res, {
        id: user.id,
        email: user.email,
        role: user.role.toLowerCase(),
        unreadAlertCount: user.notifications.length,
        streamToken: signStreamToken(user.id, user.role as "STUDENT" | "TEACHER" | "ADMIN"),
        studentProfile: user.studentProfile
          ? {
              id: user.studentProfile.id,
              name: user.studentProfile.displayName,
              schoolName: user.studentProfile.schoolName,
              grade: user.studentProfile.gradeLevel > 0 ? `${user.studentProfile.gradeLevel}학년` : null,
              classLabel: user.studentProfile.classLabel,
              track: dbTrackToFront(user.studentProfile.track),
              onboardingCompleted: user.studentProfile.onboardingCompleted,
              classroomId: user.studentProfile.classroomId,
              isConnectedToTeacher: user.studentProfile.classroomId !== null,
              goal: user.studentProfile.goalSettings[0]
                ? {
                    university: user.studentProfile.goalSettings[0].universityNameSnapshot,
                    department: user.studentProfile.goalSettings[0].departmentNameSnapshot,
                    targetGrade: user.studentProfile.goalSettings[0].targetGrade,
                    targetScore: user.studentProfile.goalSettings[0].targetScore
                  }
                : null
            }
          : null,
        teacherProfile: user.teacherProfile
          ? {
              id: user.teacherProfile.id,
              name: user.teacherProfile.displayName,
              schoolName: user.teacherProfile.schoolName,
              subjectAreas: user.teacherProfile.subjectAreas,
              inviteCode: user.teacherProfile.homeroomClassRooms[0]?.inviteCode ?? null
            }
          : null
      });
    })
  );

  router.patch(
    "/me",
    authenticate,
    validate(updateMeSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const user = await prisma.user.findUnique({
        where: { id: req.auth!.sub },
        include: {
          studentProfile: true,
          teacherProfile: true
        }
      });

      if (!user) {
        throw new ApiError(404, "NOT_FOUND", "User not found.");
      }

      if (req.body.email && req.body.email !== user.email) {
        const collision = await prisma.user.findUnique({
          where: { email: req.body.email },
          select: { id: true }
        });

        if (collision) {
          throw new ApiError(409, "CONFLICT", "Email is already in use.");
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: req.body.email ?? undefined
          }
        });

        if (user.studentProfile) {
          await tx.studentProfile.update({
            where: { id: user.studentProfile.id },
            data: {
              schoolName: req.body.schoolName ?? undefined,
              track: req.body.track ? frontTrackToDb(req.body.track) : undefined
            }
          });
        }

        if (user.teacherProfile) {
          await tx.teacherProfile.update({
            where: { id: user.teacherProfile.id },
            data: {
              schoolName: req.body.schoolName ?? undefined
            }
          });
        }
      });

      setAuditContext(req, {
        action: "ME_UPDATE",
        resourceType: "user",
        resourceId: user.id,
        afterJson: {
          email: req.body.email ?? user.email,
          schoolName:
            req.body.schoolName ??
            user.studentProfile?.schoolName ??
            user.teacherProfile?.schoolName ??
            null
        }
      });
      sendSuccess(req, res, { updated: true });
    })
  );

  router.patch(
    "/me/deactivate",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const user = await prisma.user.findUnique({
        where: { id: req.auth!.sub },
        select: { id: true, status: true }
      });

      if (!user) {
        throw new ApiError(404, "NOT_FOUND", "User not found.");
      }

      if (user.status === "DELETED") {
        throw new ApiError(409, "CONFLICT", "Account is already deactivated.");
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            status: "DELETED",
            deletedAt: new Date()
          }
        });

        await tx.refreshToken.updateMany({
          where: { userId: user.id, status: "ACTIVE" },
          data: { status: "ROTATED" }
        });
      });

      setAuditContext(req, {
        action: "ME_DEACTIVATE",
        resourceType: "user",
        resourceId: user.id,
        afterJson: { status: "DELETED" }
      });

      sendSuccess(req, res, { deactivated: true });
    })
  );
};
