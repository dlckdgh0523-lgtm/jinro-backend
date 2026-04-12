import type { SemesterTerm } from "@prisma/client";
import { prisma } from "../infra/prisma";

export const gradeRepository = {
  replaceExamRecords(input: {
    studentProfileId: string;
    academicYear: number;
    semesterTerm: SemesterTerm;
    semesterLabel: string;
    examType: "MIDTERM" | "FINAL";
    subjects: Array<{
      name: string;
      score: number;
      status?: string;
      memo?: string;
    }>;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.gradeExamRecord.deleteMany({
        where: {
          studentProfileId: input.studentProfileId,
          academicYear: input.academicYear,
          semesterTerm: input.semesterTerm,
          examType: input.examType
        }
      });

      if (input.subjects.length > 0) {
        await tx.gradeExamRecord.createMany({
          data: input.subjects.map((subject) => ({
            studentProfileId: input.studentProfileId,
            academicYear: input.academicYear,
            semesterTerm: input.semesterTerm,
            semesterLabel: input.semesterLabel,
            examType: input.examType,
            subjectName: subject.name,
            score: subject.score,
            statusLabel: subject.status,
            memo: subject.memo
          }))
        });
      }
    });
  },

  replaceSemesterFinalGrades(input: {
    studentProfileId: string;
    academicYear: number;
    semesterTerm: SemesterTerm;
    semesterLabel: string;
    averageGrade: number | null;
    subjects: Array<{
      name: string;
      finalGrade: number;
      credit: number;
      applied: boolean;
    }>;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.semesterFinalGrade.deleteMany({
        where: {
          studentProfileId: input.studentProfileId,
          academicYear: input.academicYear,
          semesterTerm: input.semesterTerm
        }
      });

      if (input.subjects.length > 0) {
        await tx.semesterFinalGrade.createMany({
          data: input.subjects.map((subject) => ({
            studentProfileId: input.studentProfileId,
            academicYear: input.academicYear,
            semesterTerm: input.semesterTerm,
            semesterLabel: input.semesterLabel,
            subjectName: subject.name,
            finalGrade: subject.finalGrade,
            credit: subject.credit,
            applied: subject.applied
          }))
        });
      }

      await tx.studentProfile.update({
        where: { id: input.studentProfileId },
        data: {
          currentAverageGrade: input.averageGrade
        }
      });
    });
  },

  replaceMockExamResults(input: {
    studentProfileId: string;
    academicYear: number;
    examMonth: number;
    examLabel: string;
    subjects: Array<{
      name: string;
      score?: number;
      grade?: number;
    }>;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.mockExamResult.deleteMany({
        where: {
          studentProfileId: input.studentProfileId,
          academicYear: input.academicYear,
          examMonth: input.examMonth,
          examLabel: input.examLabel
        }
      });

      if (input.subjects.length > 0) {
        await tx.mockExamResult.createMany({
          data: input.subjects.map((subject) => ({
            studentProfileId: input.studentProfileId,
            academicYear: input.academicYear,
            examMonth: input.examMonth,
            examLabel: input.examLabel,
            subjectName: subject.name,
            score: subject.score,
            grade: subject.grade
          }))
        });
      }
    });
  },

  listSemesterFinalGrades(studentProfileId: string, order: "asc" | "desc" = "asc") {
    return prisma.semesterFinalGrade.findMany({
      where: { studentProfileId },
      orderBy: [{ academicYear: order }, { semesterTerm: order }, { subjectName: "asc" }]
    });
  },

  listExamRecords(studentProfileId: string) {
    return prisma.gradeExamRecord.findMany({
      where: { studentProfileId },
      orderBy: [{ academicYear: "asc" }, { semesterTerm: "asc" }, { examType: "asc" }, { subjectName: "asc" }]
    });
  },

  listMockExamResults(studentProfileId: string) {
    return prisma.mockExamResult.findMany({
      where: { studentProfileId },
      orderBy: [{ academicYear: "asc" }, { examMonth: "asc" }, { subjectName: "asc" }]
    });
  }
};
