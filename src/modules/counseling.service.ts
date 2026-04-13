import { setAuditContext } from "../infra/audit";
import { prisma } from "../infra/prisma";
import { sseBroker } from "../infra/realtime";
import type { AuthenticatedRequest } from "../infra/security";
import type { CounselingRequestStatus } from "@prisma/client";
import { ApiError } from "../common/http";
import { ensureTeacherProfileId, resolveStudentProfileId } from "../common/domain";
import { counselingRepository } from "./counseling.repository";
import type {
  CreateMemoInput,
  CreateRequestInput,
  MemoQueryInput,
  RequestQueryInput,
  UpdateMemoInput,
  UpdateRequestStatusInput
} from "./counseling.validator";

const requestTypeToDb = (value: string) => {
  if (value === "학업 고민") return "ACADEMIC";
  if (value === "진로 고민") return "CAREER";
  if (value === "정서적 지원") return "EMOTIONAL";
  return "OTHER";
};

const requestTypeToFront = (value: "ACADEMIC" | "CAREER" | "EMOTIONAL" | "OTHER") => {
  if (value === "ACADEMIC") return "학업 고민";
  if (value === "CAREER") return "진로 고민";
  if (value === "EMOTIONAL") return "정서적 지원";
  return "기타";
};

const requestStatusToFront = (value: CounselingRequestStatus | null | undefined) => {
  if (value === "IN_PROGRESS") return "in_progress";
  if (value === "COMPLETED") return "completed";
  if (value === "CANCELED") return "canceled";
  if (value === "REJECTED") return "rejected";
  return "pending";
};

const requestStatusToDb = (value: UpdateRequestStatusInput["status"] | RequestQueryInput["status"]) => {
  if (value === "in_progress") return "IN_PROGRESS";
  if (value === "completed") return "COMPLETED";
  if (value === "canceled") return "CANCELED";
  if (value === "rejected") return "REJECTED";
  if (value === "pending") return "PENDING";
  return undefined;
};

export const counselingService = {
  async listRequests(req: AuthenticatedRequest, query: RequestQueryInput) {
    const status = requestStatusToDb(query.status);
    const requests =
      req.auth!.role === "STUDENT"
        ? await counselingRepository.listRequestsByStudent(
            await resolveStudentProfileId(prisma, req.auth!),
            status
          )
        : await counselingRepository.listRequestsByTeacher(
            await ensureTeacherProfileId(prisma, req.auth!),
            query.studentId,
            status
          );

    return requests.map((item) => ({
      id: item.id,
      student: item.studentProfile.displayName,
      type: requestTypeToFront(item.type),
      message: item.message,
      date: item.requestedAt.toISOString().slice(0, 10),
      status: requestStatusToFront(item.status)
    }));
  },

  async createRequest(req: AuthenticatedRequest, input: CreateRequestInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!);
    const assignment = await counselingRepository.findActiveAssignmentForStudent(studentProfileId);

    if (!assignment) {
      throw new ApiError(409, "CONFLICT", "No assigned teacher found for this student.");
    }

    const request = await counselingRepository.createRequest({
      studentProfileId,
      teacherProfileId: assignment.teacherProfileId,
      type: requestTypeToDb(input.type),
      message: input.message
    });

    const notification = await counselingRepository.createNotification({
      userId: assignment.teacherProfile.userId,
      type: "INFO",
      category: "상담",
      title: "새 상담 요청이 도착했습니다",
      body: `${assignment.studentProfile.displayName} 학생의 ${input.type} 상담이 도착했습니다.`,
      relatedType: "COUNSELING_REQUEST",
      relatedId: request.id
    });

    sseBroker.publishToUser(assignment.teacherProfile.userId, "counseling.request.created", {
      requestId: request.id,
      notificationId: notification.id
    });

    setAuditContext(req, {
      action: "COUNSELING_REQUEST_CREATE",
      resourceType: "counseling-request",
      resourceId: request.id,
      afterJson: {
        type: request.type,
        status: request.status
      }
    });

    return {
      id: request.id,
      type: input.type,
      message: request.message,
      date: request.requestedAt.toISOString().slice(0, 10),
      status: "pending"
    };
  },

  async updateRequestStatus(
    req: AuthenticatedRequest,
    requestId: string,
    input: UpdateRequestStatusInput
  ) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const counselingRequest = await counselingRepository.findRequestWithStudentUser(requestId);

    if (!counselingRequest || counselingRequest.teacherProfileId !== teacherProfileId) {
      throw new ApiError(404, "NOT_FOUND", "Counseling request not found.");
    }

    const nextStatus = requestStatusToDb(input.status)!;
    const updated = await counselingRepository.updateRequestStatus({
      requestId: counselingRequest.id,
      status: nextStatus,
      startedAt: nextStatus === "IN_PROGRESS" ? new Date() : counselingRequest.startedAt,
      completedAt: nextStatus === "COMPLETED" || nextStatus === "CANCELED" || nextStatus === "REJECTED" ? new Date() : null
    });

    sseBroker.publishToUser(counselingRequest.studentProfile.userId, "counseling.request.updated", {
      requestId: updated.id,
      status: requestStatusToFront(updated.status)
    });

    setAuditContext(req, {
      action: "COUNSELING_REQUEST_STATUS_UPDATE",
      resourceType: "counseling-request",
      resourceId: updated.id,
      beforeJson: {
        status: counselingRequest.status
      },
      afterJson: {
        status: updated.status
      }
    });

    return {
      id: updated.id,
      status: requestStatusToFront(updated.status)
    };
  },

  async listMemos(req: AuthenticatedRequest, query: MemoQueryInput) {
    const memos =
      req.auth!.role === "STUDENT"
        ? await counselingRepository.listMemosForStudent(
            await resolveStudentProfileId(prisma, req.auth!)
          )
        : await counselingRepository.listMemosForTeacher(
            await ensureTeacherProfileId(prisma, req.auth!),
            query.studentId
          );

    return memos.map((memo) => ({
      id: memo.id,
      student: memo.studentProfile.displayName,
      teacher: memo.teacherProfile.displayName,
      date: memo.createdAt.toISOString().slice(0, 10),
      subject: memo.title,
      content: memo.content,
      tag: memo.tag,
      shared: memo.visibility === "STUDENT_SHARED"
    }));
  },

  async createMemo(req: AuthenticatedRequest, input: CreateMemoInput) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    await resolveStudentProfileId(prisma, req.auth!, input.studentId);

    const memo = await counselingRepository.createMemo({
      counselingRequestId: input.requestId,
      studentProfileId: input.studentId,
      teacherProfileId,
      title: input.subject,
      content: input.content,
      tag: input.tag,
      visibility: input.shareWithStudent ? "STUDENT_SHARED" : "TEACHER_ONLY",
      sharedAt: input.shareWithStudent ? new Date() : null
    });

    if (memo.visibility === "STUDENT_SHARED") {
      const notification = await counselingRepository.createNotification({
        userId: memo.studentProfile.userId,
        type: "INFO",
        category: "상담",
        title: "선생님 메모가 도착했습니다",
        body: input.subject,
        relatedType: "COUNSELING_MEMO",
        relatedId: memo.id
      });

      sseBroker.publishToUser(memo.studentProfile.userId, "counseling.memo.created", {
        memoId: memo.id,
        notificationId: notification.id
      });
    }

    setAuditContext(req, {
      action: "COUNSELING_MEMO_CREATE",
      resourceType: "counseling-memo",
      resourceId: memo.id,
      afterJson: {
        title: memo.title,
        visibility: memo.visibility
      }
    });

    return {
      id: memo.id,
      subject: memo.title,
      content: memo.content,
      tag: memo.tag
    };
  },

  async updateMemo(req: AuthenticatedRequest, memoId: string, input: UpdateMemoInput) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const memo = await counselingRepository.findMemoById(memoId);

    if (!memo || memo.teacherProfileId !== teacherProfileId || memo.deletedAt) {
      throw new ApiError(404, "NOT_FOUND", "Counseling memo not found.");
    }

    const updated = await counselingRepository.updateMemo({
      memoId: memo.id,
      title: input.subject,
      content: input.content,
      tag: input.tag,
      visibility:
        typeof input.shareWithStudent === "boolean"
          ? input.shareWithStudent
            ? "STUDENT_SHARED"
            : "TEACHER_ONLY"
          : undefined,
      sharedAt:
        typeof input.shareWithStudent === "boolean" && input.shareWithStudent
          ? new Date()
          : input.shareWithStudent === false
            ? null
            : undefined
    });

    setAuditContext(req, {
      action: "COUNSELING_MEMO_UPDATE",
      resourceType: "counseling-memo",
      resourceId: updated.id,
      beforeJson: {
        title: memo.title,
        tag: memo.tag,
        visibility: memo.visibility
      },
      afterJson: {
        title: updated.title,
        tag: updated.tag,
        visibility: updated.visibility
      }
    });

    return {
      id: updated.id,
      subject: updated.title,
      content: updated.content,
      tag: updated.tag
    };
  },

  async deleteMemo(req: AuthenticatedRequest, memoId: string) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const memo = await counselingRepository.findMemoById(memoId);

    if (!memo || memo.teacherProfileId !== teacherProfileId || memo.deletedAt) {
      throw new ApiError(404, "NOT_FOUND", "Counseling memo not found.");
    }

    await counselingRepository.softDeleteMemo(memo.id);

    setAuditContext(req, {
      action: "COUNSELING_MEMO_DELETE",
      resourceType: "counseling-memo",
      resourceId: memo.id,
      beforeJson: {
        title: memo.title,
        tag: memo.tag
      }
    });

    return { deleted: true };
  }
};
