import { z } from "zod";

export const admissionsQuerySchema = z.object({
  search: z.string().optional(),
  year: z.coerce.number().int().optional(),
  type: z.enum(["수시", "정시"]).optional(),
  category: z.enum(["학생부교과", "학생부종합", "논술", "수능위주", "실기/실적"]).optional(),
  region: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export type AdmissionsQueryInput = z.infer<typeof admissionsQuerySchema>;
