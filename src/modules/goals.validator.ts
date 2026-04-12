import { z } from "zod";

export const goalQuerySchema = z.object({
  studentId: z.string().uuid().optional()
});

export const saveGoalSchema = z.object({
  studentId: z.string().uuid().optional(),
  university: z.string().min(1),
  department: z.string().min(1),
  field: z.string().min(1),
  targetGrade: z.coerce.number().min(1).max(9),
  targetScore: z.coerce.number().int().min(0).max(500)
});

export type GoalQueryInput = z.infer<typeof goalQuerySchema>;
export type SaveGoalInput = z.infer<typeof saveGoalSchema>;
