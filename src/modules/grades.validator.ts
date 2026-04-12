import { z } from "zod";

export const gradeQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  mode: z.enum(["final", "exam", "practice"]).default("final")
});

export const examSaveSchema = z.object({
  studentId: z.string().uuid().optional(),
  semester: z.string().min(1),
  examType: z.enum(["중간고사", "기말고사"]),
  subjects: z.array(
    z.object({
      name: z.string().min(1),
      score: z.coerce.number().min(0).max(100),
      status: z.string().optional(),
      memo: z.string().optional()
    })
  )
});

export const semesterFinalSaveSchema = z.object({
  studentId: z.string().uuid().optional(),
  semester: z.string().min(1),
  subjects: z.array(
    z.object({
      name: z.string().min(1),
      finalGrade: z.coerce.number().min(1).max(9),
      credit: z.coerce.number().int().min(1).max(8),
      applied: z.boolean().default(false)
    })
  )
});

export const mockExamSaveSchema = z.object({
  studentId: z.string().uuid().optional(),
  semester: z.string().min(1),
  subjects: z.array(
    z.object({
      name: z.string().min(1),
      score: z.coerce.number().min(0).max(100).optional(),
      grade: z.coerce.number().min(1).max(9).optional()
    })
  )
});

export type GradeQueryInput = z.infer<typeof gradeQuerySchema>;
export type ExamSaveInput = z.infer<typeof examSaveSchema>;
export type SemesterFinalSaveInput = z.infer<typeof semesterFinalSaveSchema>;
export type MockExamSaveInput = z.infer<typeof mockExamSaveSchema>;
