import { prisma } from "../infra/prisma";
import { ApiError } from "../common/http";
import type { SubscriptionStatus, UserStatus } from "@prisma/client";
import { subscriptionRepository } from "./subscription.repository";

export const adminService = {
  async getOverview() {
    const [userCount, studentCount, teacherCount, classroomCount, subscriptionCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: "STUDENT" } }),
        prisma.user.count({ where: { role: "TEACHER" } }),
        prisma.classRoom.count({ where: { deletedAt: null } }),
        prisma.subscription.count({ where: { status: { in: ["TRIALING", "ACTIVE"] } } })
      ]);

    return { userCount, studentCount, teacherCount, classroomCount, activeSubscriptionCount: subscriptionCount };
  },

  async listUsers(page: number, pageSize: number) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true }
      }),
      prisma.user.count()
    ]);
    return { users, total };
  },

  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        teacherProfile: { include: { homeroomClassRooms: { where: { deletedAt: null } } } },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 5 }
      }
    });
    if (!user) throw new ApiError(404, "NOT_FOUND", "User not found.");
    return user;
  },

  async updateUserStatus(userId: string, status: UserStatus, _reason?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "NOT_FOUND", "User not found.");
    return prisma.user.update({ where: { id: userId }, data: { status } });
  },

  async listTeachers(page: number, pageSize: number) {
    const [teachers, total] = await Promise.all([
      prisma.teacherProfile.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, email: true, status: true } }, homeroomClassRooms: { where: { deletedAt: null } } }
      }),
      prisma.teacherProfile.count()
    ]);
    return { teachers, total };
  },

  async listStudents(page: number, pageSize: number) {
    const [students, total] = await Promise.all([
      prisma.studentProfile.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, email: true, status: true } } }
      }),
      prisma.studentProfile.count()
    ]);
    return { students, total };
  },

  async listClassrooms(page: number, pageSize: number) {
    const [classrooms, total] = await Promise.all([
      prisma.classRoom.findMany({
        where: { deletedAt: null },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { homeroomTeacher: { select: { displayName: true } }, _count: { select: { students: true } } }
      }),
      prisma.classRoom.count({ where: { deletedAt: null } })
    ]);
    return { classrooms, total };
  },

  async listSubscriptions(page: number, pageSize: number) {
    const [subscriptions, total] = await Promise.all([
      subscriptionRepository.listAll(page, pageSize),
      subscriptionRepository.countAll()
    ]);
    return { subscriptions, total };
  },

  async updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus, reason?: string) {
    const sub = await subscriptionRepository.findById(subscriptionId);
    if (!sub) throw new ApiError(404, "NOT_FOUND", "Subscription not found.");
    const [updated] = await subscriptionRepository.updateStatus(subscriptionId, status, reason);
    return updated;
  },

  async listAiUsage(page: number, pageSize: number) {
    const [logs, total] = await Promise.all([
      prisma.aiUsageLog.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.aiUsageLog.count()
    ]);
    return { logs, total };
  },

  async listAuditLogs(page: number, pageSize: number) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.auditLog.count()
    ]);
    return { logs, total };
  },

  async getSystemHealth() {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return {
      database: dbOk ? "healthy" : "unhealthy",
      uptime: Math.round(process.uptime()),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
};
