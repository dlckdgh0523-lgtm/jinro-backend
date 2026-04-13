import { prisma } from "../infra/prisma";

export const counselingRepository = {
  listRequestsByStudent(studentProfileId: string, status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "REJECTED") {
    return prisma.counselingRequest.findMany({
      where: {
        studentProfileId,
        status
      },      take: 20,

      orderBy: { requestedAt: "desc" },
      include: {
        studentProfile: true
      }
    });
  },

  listRequestsByTeacher(
    teacherProfileId: string,
    studentProfileId?: string,
    status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "REJECTED"
  ) {
    return prisma.counselingRequest.findMany({
      where: {
        teacherProfileId,
        studentProfileId,
        status
      },
      orderBy: { requestedAt: "desc" },
      include: {
        studentProfile: true
      }
    });
  },

  findActiveAssignmentForStudent(studentProfileId: string) {
    return prisma.teacherStudentAssignment.findFirst({
      where: {
        studentProfileId,
        active: true
      },
      include: {
        teacherProfile: true,
        studentProfile: true
      }
    });
  },

  createRequest(input: {
    studentProfileId: string;
    teacherProfileId: string;
    type: "ACADEMIC" | "CAREER" | "EMOTIONAL" | "OTHER";
    message: string;
  }) {
    return prisma.counselingRequest.create({
      data: {
        studentProfileId: input.studentProfileId,
        teacherProfileId: input.teacherProfileId,
        type: input.type,
        message: input.message,
        status: "PENDING"
      }
    });
  },

  createNotification(input: {
    userId: string;
    type: "INFO" | "WARNING" | "SUCCESS" | "DANGER";
    category: string;
    title: string;
    body: string;
    relatedType?: "COUNSELING_REQUEST" | "COUNSELING_MEMO";
    relatedId?: string;
  }) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        category: input.category,
        title: input.title,
        body: input.body,
        relatedType: input.relatedType,
        relatedId: input.relatedId
      }
    });
  },

  findRequestWithStudentUser(requestId: string) {
    return prisma.counselingRequest.findUnique({
      where: { id: requestId },
      include: {
        studentProfile: {
          include: {
            user: true
          }
        }
      }
    });
  },

  updateRequestStatus(input: {
    requestId: string;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "REJECTED";
    startedAt?: Date | null;
    completedAt?: Date | null;
  }) {
    return prisma.counselingRequest.update({
      where: { id: input.requestId },
      data: {
        status: input.status,
        startedAt: input.startedAt,
        completedAt: input.completedAt
      }
    });
  },

  listMemosForStudent(studentProfileId: string) {
    return prisma.counselingMemo.findMany({
      where: {
        studentProfileId,
        deletedAt: null,
        visibility: "STUDENT_SHARED"
      },
      orderBy: { createdAt: "desc" },
      include: {
        studentProfile: true,
        teacherProfile: true
      }
    });
  },

  listMemosForTeacher(teacherProfileId: string, studentProfileId?: string) {
    return prisma.counselingMemo.findMany({
      where: {
        teacherProfileId,
        studentProfileId,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" },
      include: {
        studentProfile: true,
        teacherProfile: true
      }
    });
  },

  createMemo(input: {
    counselingRequestId?: string;
    studentProfileId: string;
    teacherProfileId: string;
    title: string;
    content: string;
    tag: string;
    visibility: "STUDENT_SHARED" | "TEACHER_ONLY";
    sharedAt: Date | null;
  }) {
    return prisma.counselingMemo.create({
      data: {
        counselingRequestId: input.counselingRequestId,
        studentProfileId: input.studentProfileId,
        teacherProfileId: input.teacherProfileId,
        title: input.title,
        content: input.content,
        tag: input.tag,
        visibility: input.visibility,
        sharedAt: input.sharedAt
      },
      include: {
        studentProfile: {
          include: {
            user: true
          }
        }
      }
    });
  },

  findMemoById(memoId: string) {
    return prisma.counselingMemo.findUnique({
      where: { id: memoId }
    });
  },

  updateMemo(input: {
    memoId: string;
    title?: string;
    content?: string;
    tag?: string;
    visibility?: "STUDENT_SHARED" | "TEACHER_ONLY";
    sharedAt?: Date | null;
  }) {
    return prisma.counselingMemo.update({
      where: { id: input.memoId },
      data: {
        title: input.title,
        content: input.content,
        tag: input.tag,
        visibility: input.visibility,
        sharedAt: input.sharedAt
      }
    });
  },

  softDeleteMemo(memoId: string) {
    return prisma.counselingMemo.update({
      where: { id: memoId },
      data: { deletedAt: new Date() }
    });
  }
};
