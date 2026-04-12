import { z } from "zod";

export const studyPlanQuerySchema = z.object({
  studentId: z.string().uuid().optional()
});

export const createTaskSchema = z.object({
  studentId: z.string().uuid().optional(),
  subject: z.string().min(1),
  task: z.string().min(1),
  day: z.string().min(1),
  priority: z.enum(["high", "medium", "low"])
});

export const taskParamsSchema = z.object({
  taskId: z.string().uuid()
});

export const updateTaskSchema = z.object({
  studentId: z.string().uuid().optional(),
  subject: z.string().min(1).optional(),
  task: z.string().min(1).optional(),
  day: z.string().min(1).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  done: z.boolean().optional()
});

export type StudyPlanQuery = z.infer<typeof studyPlanQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
