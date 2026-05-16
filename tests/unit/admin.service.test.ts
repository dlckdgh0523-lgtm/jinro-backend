import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/infra/prisma", () => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    studentProfile: { findMany: vi.fn(), count: vi.fn() },
    teacherProfile: { findMany: vi.fn(), count: vi.fn() },
    classRoom: { findMany: vi.fn(), count: vi.fn() },
    subscription: { count: vi.fn() },
    aiUsageLog: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn()
  }
}));

vi.mock("../../src/modules/subscription.repository", () => ({
  subscriptionRepository: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    listAll: vi.fn(),
    countAll: vi.fn()
  }
}));

let adminService: typeof import("../../src/modules/admin.service").adminService;
let prisma: any;
let subscriptionRepository: any;

beforeAll(async () => {
  const svc = await import("../../src/modules/admin.service");
  const prismaModule = await import("../../src/infra/prisma");
  const subRepo = await import("../../src/modules/subscription.repository");
  adminService = svc.adminService;
  prisma = prismaModule.prisma;
  subscriptionRepository = subRepo.subscriptionRepository;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminService", () => {
  describe("getOverview", () => {
    it("returns aggregated counts", async () => {
      vi.mocked(prisma.user.count)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(30);
      vi.mocked(prisma.classRoom.count).mockResolvedValue(5);
      vi.mocked(prisma.subscription.count).mockResolvedValue(45);

      const result = await adminService.getOverview();

      expect(result).toEqual({
        userCount: 100,
        studentCount: 60,
        teacherCount: 30,
        classroomCount: 5,
        activeSubscriptionCount: 45
      });
    });
  });

  describe("listUsers", () => {
    it("returns paginated users with total count", async () => {
      const users = [{ id: "1", email: "a@b.com" }];
      vi.mocked(prisma.user.findMany).mockResolvedValue(users);
      vi.mocked(prisma.user.count).mockResolvedValue(50);

      const result = await adminService.listUsers(1, 20);

      expect(result).toEqual({ users, total: 50 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 })
      );
    });

    it("calculates correct skip for page 3", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await adminService.listUsers(3, 10);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });
  });

  describe("getUserDetail", () => {
    it("throws NOT_FOUND if user does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        adminService.getUserDetail("nonexistent")
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });

    it("returns user with related profiles and subscriptions", async () => {
      const user = {
        id: "u1",
        email: "test@test.com",
        studentProfile: { id: "sp1" },
        teacherProfile: null,
        subscriptions: []
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user);

      const result = await adminService.getUserDetail("u1");

      expect(result).toEqual(user);
    });
  });

  describe("updateUserStatus", () => {
    it("throws NOT_FOUND if user does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        adminService.updateUserStatus("nonexistent", "DISABLED" as any)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("updates user status", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" });
      const updated = { id: "u1", status: "DISABLED" };
      vi.mocked(prisma.user.update).mockResolvedValue(updated as any);

      const result = await adminService.updateUserStatus("u1", "DISABLED" as any);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { status: "DISABLED" }
      });
      expect(result).toEqual(updated);
    });
  });

  describe("listTeachers", () => {
    it("returns paginated teachers", async () => {
      const teachers = [{ id: "t1" }];
      vi.mocked(prisma.teacherProfile.findMany).mockResolvedValue(teachers);
      vi.mocked(prisma.teacherProfile.count).mockResolvedValue(10);

      const result = await adminService.listTeachers(1, 20);

      expect(result).toEqual({ teachers, total: 10 });
    });
  });

  describe("listStudents", () => {
    it("returns paginated students", async () => {
      const students = [{ id: "s1" }];
      vi.mocked(prisma.studentProfile.findMany).mockResolvedValue(students);
      vi.mocked(prisma.studentProfile.count).mockResolvedValue(5);

      const result = await adminService.listStudents(1, 20);

      expect(result).toEqual({ students, total: 5 });
    });
  });

  describe("listClassrooms", () => {
    it("returns paginated active classrooms", async () => {
      const classrooms = [{ id: "c1" }];
      vi.mocked(prisma.classRoom.findMany).mockResolvedValue(classrooms);
      vi.mocked(prisma.classRoom.count).mockResolvedValue(3);

      const result = await adminService.listClassrooms(1, 20);

      expect(result).toEqual({ classrooms, total: 3 });
    });
  });

  describe("listSubscriptions", () => {
    it("delegates to subscription repository", async () => {
      vi.mocked(subscriptionRepository.listAll).mockResolvedValue([]);
      vi.mocked(subscriptionRepository.countAll).mockResolvedValue(0);

      const result = await adminService.listSubscriptions(1, 20);

      expect(result).toEqual({ subscriptions: [], total: 0 });
    });
  });

  describe("updateSubscriptionStatus", () => {
    it("throws NOT_FOUND if subscription does not exist", async () => {
      vi.mocked(subscriptionRepository.findById).mockResolvedValue(null);

      await expect(
        adminService.updateSubscriptionStatus("sub-1", "CANCELED" as any)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("updates subscription status with reason", async () => {
      vi.mocked(subscriptionRepository.findById).mockResolvedValue({ id: "sub-1" });
      const updated = { id: "sub-1", status: "CANCELED" };
      vi.mocked(subscriptionRepository.updateStatus).mockResolvedValue([updated as any, {} as any]);

      const result = await adminService.updateSubscriptionStatus("sub-1", "CANCELED" as any, "admin action");

      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith("sub-1", "CANCELED", "admin action");
      expect(result).toEqual(updated);
    });
  });

  describe("listAiUsage", () => {
    it("returns paginated AI usage logs", async () => {
      vi.mocked(prisma.aiUsageLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiUsageLog.count).mockResolvedValue(0);

      const result = await adminService.listAiUsage(1, 20);

      expect(result).toEqual({ logs: [], total: 0 });
    });
  });

  describe("listAuditLogs", () => {
    it("returns paginated audit logs", async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

      const result = await adminService.listAuditLogs(1, 20);

      expect(result).toEqual({ logs: [], total: 0 });
    });
  });

  describe("getSystemHealth", () => {
    it("returns healthy when database is reachable", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

      const result = await adminService.getSystemHealth();

      expect(result.database).toBe("healthy");
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.memoryUsage).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it("returns unhealthy when database is unreachable", async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused"));

      const result = await adminService.getSystemHealth();

      expect(result.database).toBe("unhealthy");
    });
  });
});
