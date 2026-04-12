import type { Response } from "express";
import { setAuditContext } from "../infra/audit";
import { sseBroker } from "../infra/realtime";
import { signStreamToken, type AuthenticatedRequest } from "../infra/security";
import { ApiError, makePagination } from "../common/http";
import { formatRelativeTimeKo } from "../common/domain";
import { env } from "../config/env";
import { notificationRepository } from "./notifications.repository";
import type { NotificationListInput } from "./notifications.validator";

const serializeNotification = (notification: {
  id: string;
  type: "DANGER" | "WARNING" | "INFO" | "SUCCESS";
  category: string;
  title: string;
  body: string;
  status: "UNREAD" | "READ" | "DISMISSED";
  createdAt: Date;
}) => ({
  id: notification.id,
  type:
    notification.type === "DANGER"
      ? "danger"
      : notification.type === "WARNING"
        ? "warning"
        : notification.type === "SUCCESS"
          ? "success"
          : "info",
  category: notification.category,
  title: notification.title,
  body: notification.body,
  time: formatRelativeTimeKo(notification.createdAt),
  read: notification.status !== "UNREAD"
});

export const notificationService = {
  async list(req: AuthenticatedRequest, query: NotificationListInput) {
    const skip = (query.page - 1) * query.pageSize;
    const [items, totalItems] = await Promise.all([
      notificationRepository.listNotifications({
        userId: req.auth!.sub,
        tab: query.tab,
        skip,
        take: query.pageSize
      }),
      notificationRepository.countNotifications(req.auth!.sub, query.tab)
    ]);

    return {
      data: items.map(serializeNotification),
      meta: {
        pagination: makePagination(query.page, query.pageSize, totalItems),
        streamToken: signStreamToken(req.auth!.sub, req.auth!.role)
      }
    };
  },

  async markRead(req: AuthenticatedRequest, notificationId: string) {
    const notification = await notificationRepository.findNotificationById(notificationId);

    if (!notification || notification.userId !== req.auth!.sub) {
      throw new ApiError(404, "NOT_FOUND", "Notification not found.");
    }

    const updated = await notificationRepository.markAsRead(notification.id);

    sseBroker.publishToUser(req.auth!.sub, "notification.updated", {
      notificationId: updated.id,
      status: updated.status
    });

    setAuditContext(req, {
      action: "NOTIFICATION_READ",
      resourceType: "notification",
      resourceId: updated.id,
      beforeJson: {
        status: notification.status
      },
      afterJson: {
        status: updated.status
      }
    });

    return serializeNotification(updated);
  },

  async readAll(req: AuthenticatedRequest) {
    await notificationRepository.markAllAsRead(req.auth!.sub);

    sseBroker.publishToUser(req.auth!.sub, "notification.bulk-read", { ok: true });

    setAuditContext(req, {
      action: "NOTIFICATION_READ_ALL",
      resourceType: "notification",
      resourceId: req.auth!.sub
    });

    return { updated: true };
  },

  issueStreamToken(req: AuthenticatedRequest) {
    return {
      streamToken: signStreamToken(req.auth!.sub, req.auth!.role),
      retryMs: env.SSE_RETRY_INTERVAL_MS
    };
  },

  openStream(req: AuthenticatedRequest, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.write(`retry: ${env.SSE_RETRY_INTERVAL_MS}\n`);
    res.write("event: system.ready\n");
    res.write(`data: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);

    const unsubscribe = sseBroker.subscribe(req.auth!.sub, res);
    req.on("close", unsubscribe);
  }
};
