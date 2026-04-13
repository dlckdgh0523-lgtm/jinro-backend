import { prisma } from "../infra/prisma";

export const goalRepository = {
  findCurrentGoal(studentProfileId: string) {
    return prisma.goalSetting.findFirst({
      where: {
        studentProfileId,
        isActive: true
      },
      orderBy: { updatedAt: "desc" }
    });
  },

  upsertUniversity(name: string) {
    return prisma.university.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  },

  findStandaloneDepartment(name: string, fieldGroup: string) {
    return prisma.department.findFirst({
      where: {
        name,
        fieldGroup,
        universityId: null
      }
    });
  },

  createDepartment(name: string, fieldGroup: string) {
    return prisma.department.create({
      data: {
        name,
        fieldGroup
      }
    });
  },

  deactivateActiveGoals(studentProfileId: string) {
    return prisma.goalSetting.updateMany({
      where: {
        studentProfileId,
        isActive: true
      },
      data: { isActive: false }
    });
  },

  createGoal(input: {
    studentProfileId: string;
    fieldGroup: string;
    universityId: string;
    universityNameSnapshot: string;
    departmentId: string;
    departmentNameSnapshot: string;
    targetGrade: number;
    targetScore: number;
    version: number;
  }) {
    return prisma.goalSetting.create({
      data: {
        studentProfileId: input.studentProfileId,
        fieldGroup: input.fieldGroup,
        universityId: input.universityId,
        universityNameSnapshot: input.universityNameSnapshot,
        departmentId: input.departmentId,
        departmentNameSnapshot: input.departmentNameSnapshot,
        targetGrade: input.targetGrade,
        targetScore: input.targetScore,
        version: input.version,
        isActive: true
      }
    });
  },

  findStudentName(studentProfileId: string) {
    return prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      select: { displayName: true }
    });
  },

  findStudentAssignments(studentProfileId: string) {
    return prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: {
        assignments: {
          where: { active: true },
          include: {
            teacherProfile: true
          }
        }
      }
    });
  },

  createNotification(input: {
    userId: string;
    type: "INFO" | "WARNING" | "SUCCESS" | "DANGER";
    category: string;
    title: string;
    body: string;
    dedupeKey: string;
  }) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        category: input.category,
        title: input.title,
        body: input.body,
        dedupeKey: input.dedupeKey
      }
    });
  },

  listUniversities() {
    return prisma.university.findMany({
      orderBy: { name: "asc" }
    });
  },

  listStandaloneDepartments() {
    return prisma.department.findMany({
      where: { universityId: null },
      orderBy: [{ fieldGroup: "asc" }, { name: "asc" }]
    });
  },

  findUniversities(filter: { region?: string }) {
    return prisma.university.findMany({
      where: filter.region ? { region: filter.region } : {},
      include: {
        departments: {
          select: { id: true, name: true, fieldGroup: true }
        }
      },
      orderBy: { name: "asc" }
    });
  },

  findDepartmentsByUniversity(universityId: string) {
    return prisma.department.findMany({
      where: { universityId },
      orderBy: [{ fieldGroup: "asc" }, { name: "asc" }]
    });
  }
};
