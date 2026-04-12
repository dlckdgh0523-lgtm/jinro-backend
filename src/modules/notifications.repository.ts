import type { Prisma } from "@prisma/client";
import { prisma } from "../infra/prisma";

const buildWhere = (
  userId: string,
  tab: "all" | "unread" | "important"
): Prisma.NotificationWhereInput => {
  const importantTypes: Array<"DANGER" | "WARNING"> = ["DANGER", "WARNING"];

  if (tab === "unread") {
    return { userId, status: "UNREAD" };
  }

  if (tab === "important") {
    return {
      userId,
      type: { in: importantTypes }
    };
  }

  return { userId };
};

export const notificationRepository = {
  listNotifications(input: {
    userId: string;
    tab: "all" | "unread" | "important";
    skip: number;
    take: number;
  }) {
    return prisma.notification.findMany({
      where: buildWhere(input.userId, input.tab),
      orderBy: { createdAt: "desc" },
      skip: input.skip,
      take: input.take
    });
  },

  countNotifications(userId: string, tab: "all" | "unread" | "important") {
    return prisma.notification.count({
      where: buildWhere(userId, tab)
    });
  },

  findNotificationById(notificationId: string) {
    return prisma.notification.findUnique({
      where: { id: notificationId }
    });
  },

  markAsRead(notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "READ",
        readAt: new Date()
      }
    });
  },

  markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        status: "UNREAD"
      },
      data: {
        status: "READ",
        readAt: new Date()
      }
    });
  }
};
