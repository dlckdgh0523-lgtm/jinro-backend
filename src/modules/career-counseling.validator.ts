import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().optional()
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000)
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
