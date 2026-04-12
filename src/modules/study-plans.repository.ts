import { prisma } from "../infra/prisma";

export const studyPlanRepository = {
  getCurrentPlan(studentProfileId: string, weekStart: Date, weekEnd: Date) {
    return prisma.studyPlan.upsert({
      where: {
        studentProfileId_weekStartDate: {
          studentProfileId,
          weekStartDate: weekStart
        }
      },
      update: {
        weekEndDate: weekEnd
      },
      create: {
        studentProfileId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        source: "MANUAL"
      },
      include: {
        studentProfile: {
          select: { id: true, userId: true }
        },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ dayOrder: "asc" }, { orderIndex: "asc" }, { createdAt: "asc" }]
        }
      }
    });
  },

  createTask(input: {
    studyPlanId: string;
    subject: string;
    task: string;
    dayLabel: string;
    dayOrder: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
    orderIndex: number;
  }) {
    return prisma.studyTask.create({
      data: input
    });
  },

  findTaskWithPlan(taskId: string) {
    return prisma.studyTask.findUnique({
      where: { id: taskId },
      include: {
        studyPlan: {
          include: {
            studentProfile: {
              select: { id: true, userId: true }
            }
          }
        }
      }
    });
  },

  updateTask(
    taskId: string,
    data: {
      subject?: string;
      task?: string;
      dayLabel?: string;
      dayOrder?: number;
      priority?: "HIGH" | "MEDIUM" | "LOW";
      done?: boolean;
      completedAt?: Date | null;
    }
  ) {
    return prisma.studyTask.update({
      where: { id: taskId },
      data
    });
  },

  softDeleteTask(taskId: string) {
    return prisma.studyTask.update({
      where: { id: taskId },
      data: { deletedAt: new Date() }
    });
  },

  async recomputeCompletion(studyPlanId: string) {
    const tasks = await prisma.studyTask.findMany({
      where: {
        studyPlanId,
        deletedAt: null
      },
      select: { done: true }
    });

    const completionRate =
      tasks.length === 0 ? 0 : Math.round((tasks.filter((item) => item.done).length / tasks.length) * 100);

    await prisma.studyPlan.update({
      where: { id: studyPlanId },
      data: { completionRate }
    });

    return completionRate;
  }
};
