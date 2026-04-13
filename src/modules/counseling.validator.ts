import { z } from "zod";

export const createRequestSchema = z.object({
  type: z.string().min(1),
  message: z.string().min(1)
});

export const requestQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  status: z.enum(["pending", "in_progress", "completed", "canceled", "rejected"]).optional()
});

export const requestParamsSchema = z.object({
  requestId: z.string().uuid()
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "canceled", "rejected"])
});

export const memoQuerySchema = z.object({
  studentId: z.string().uuid().optional()
});

export const createMemoSchema = z.object({
  studentId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  subject: z.string().min(1),
  content: z.string().min(1),
  tag: z.string().min(1),
  shareWithStudent: z.boolean().default(false)
});

export const memoParamsSchema = z.object({
  memoId: z.string().uuid()
});

export const updateMemoSchema = z.object({
  subject: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  shareWithStudent: z.boolean().optional()
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type RequestQueryInput = z.infer<typeof requestQuerySchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;
export type MemoQueryInput = z.infer<typeof memoQuerySchema>;
export type CreateMemoInput = z.infer<typeof createMemoSchema>;
export type UpdateMemoInput = z.infer<typeof updateMemoSchema>;
