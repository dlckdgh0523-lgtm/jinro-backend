import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const studentSignupSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    passwordConfirm: z.string().min(8),
    inviteCode: z.string().trim().optional()
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Password confirmation does not match.",
    path: ["passwordConfirm"]
  });

export const teacherSignupSchema = z
  .object({
    schoolName: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    passwordConfirm: z.string().min(8),
    grade: z.union([z.string(), z.number()]),
    classNum: z.union([z.string(), z.number()]),
    subject: z.string().optional().default("")
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Password confirmation does not match.",
    path: ["passwordConfirm"]
  });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export const inviteValidationSchema = z.object({
  inviteCode: z.string().min(1)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type StudentSignupInput = z.infer<typeof studentSignupSchema>;
export type TeacherSignupInput = z.infer<typeof teacherSignupSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type InviteValidationInput = z.infer<typeof inviteValidationSchema>;
