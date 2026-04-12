import { z } from "zod";

export const notificationListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  tab: z.enum(["all", "unread", "important"]).default("all")
});

export const notificationParamsSchema = z.object({
  notificationId: z.string().uuid()
});

export type NotificationListInput = z.infer<typeof notificationListSchema>;
