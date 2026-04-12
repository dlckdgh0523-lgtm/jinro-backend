import { z } from "zod";

export const studentListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["normal", "warning", "danger"]).optional()
});

export const studentParamsSchema = z.object({
  studentId: z.string().uuid()
});

export type StudentListQueryInput = z.infer<typeof studentListQuerySchema>;
export type StudentParamsInput = z.infer<typeof studentParamsSchema>;
