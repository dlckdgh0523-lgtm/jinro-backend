import { prisma } from "../infra/prisma";

export const dashboardRepository = {
  listAssignedStudentProfileIds(teacherProfileId: string) {
    return prisma.teacherStudentAssignment.findMany({
      where: {
        teacherProfileId,
        active: true
      },
      select: {
        studentProfileId: true
      }
    });
  },

  findStudentCardData(studentProfileId: string, weekStart: Date) {
    return prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: {
        goalSettings: {
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
          take: 1
        },
        semesterFinalGrades: true,
        studyPlans: {
          where: { weekStartDate: weekStart },
          include: {
            tasks: {
              where: { deletedAt: null }
            }
          }
        },
        counselingRequests: {
          where: {
            status: {
              in: ["PENDING", "IN_PROGRESS"]
            }
          }
        }
      }
    });
  },

  findTeacherStudentAssignment(teacherProfileId: string, studentProfileId: string) {
    return prisma.teacherStudentAssignment.findFirst({
      where: {
        teacherProfileId,
        studentProfileId,
        active: true
      }
    });
  },

  findStudentWithUser(studentProfileId: string) {
    return prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: { user: true }
    });
  },

  listNotificationsForUser(userId: string, take: number) {
    return prisma.notification.findMany({
      where: {
        userId
      },
      orderBy: { createdAt: "desc" },
      take
    });
  },

  listRecentMemos(studentProfileId: string, take: number) {
    return prisma.counselingMemo.findMany({
      where: {
        studentProfileId,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        teacherProfile: true
      }
    });
  },

  findTeacherProfile(teacherProfileId: string) {
    return prisma.teacherProfile.findUnique({
      where: { id: teacherProfileId },
      include: {
        homeroomClassRooms: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 1
        }
      }
    });
  },

  findTeacherClassroom(teacherProfileId: string) {
    return prisma.classRoom.findFirst({
      where: {
        homeroomTeacherId: teacherProfileId,
        deletedAt: null
      },
      orderBy: { updatedAt: "desc" }
    });
  },

  findStudentDashboardData(studentProfileId: string, weekStart: Date) {
    return prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentProfileId },
      include: {
        user: {
          include: {
            notifications: {
              orderBy: { createdAt: "desc" },
              take: 5
            }
          }
        },
        goalSettings: {
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
          take: 1
        },
        semesterFinalGrades: true,
        studyPlans: {
          where: { weekStartDate: weekStart },
          include: {
            tasks: {
              where: { deletedAt: null },
              orderBy: [{ dayOrder: "asc" }, { orderIndex: "asc" }]
            }
          }
        }
      }
    });
  },

  listTeacherCounselingRequests(teacherProfileId: string, take: number) {
    return prisma.counselingRequest.findMany({
      where: {
        teacherProfileId,
        status: {
          in: ["PENDING", "IN_PROGRESS"]
        }
      },
      orderBy: { requestedAt: "desc" },
      take,
      include: {
        studentProfile: true
      }
    });
  },

  listStudyPlansForStudents(studentProfileIds: string[]) {
    return prisma.studyPlan.findMany({
      where: {
        studentProfileId: {
          in: studentProfileIds
        }
      },
      orderBy: { weekStartDate: "asc" }
    });
  }
};
