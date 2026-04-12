import { setAuditContext } from "../infra/audit";
import { prisma } from "../infra/prisma";
import type { AuthenticatedRequest } from "../infra/security";
import { ApiError } from "../common/http";
import { parseMockMonth, parseSemesterLabel, resolveStudentProfileId } from "../common/domain";
import { gradeRepository } from "./grades.repository";
import type {
  ExamSaveInput,
  GradeQueryInput,
  MockExamSaveInput,
  SemesterFinalSaveInput
} from "./grades.validator";

const SUBJECT_COLORS = ["#C5614A", "#8FB8A8", "#E8A598", "#A8C4B8", "#80C0C8", "#A8B4E8"];

const colorFor = (subject: string, index: number) =>
  SUBJECT_COLORS[index % SUBJECT_COLORS.length] ?? "#F8C4A0";

const makeLines = (subjects: string[]) =>
  subjects.map((subject, index) => ({
    dataKey: subject,
    label: subject,
    color: colorFor(subject, index)
  }));

const semesterOrder = (term: "FIRST" | "SECOND" | "SUMMER" | "WINTER") =>
  term === "FIRST" ? 1 : term === "SECOND" ? 2 : term === "SUMMER" ? 3 : 4;

const buildAverageGrade = (subjects: SemesterFinalSaveInput["subjects"]) =>
  subjects.length === 0
    ? null
    : Number(
        (
          subjects.reduce((total, subject) => total + subject.finalGrade, 0) / subjects.length
        ).toFixed(2)
      );

const parseAcademicYear = (label: string) => {
  const match = label.match(/(\d{4})/);
  if (!match) {
    throw new ApiError(400, "VALIDATION_ERROR", `Invalid academic year label: ${label}`);
  }

  return Number(match[1]);
};

export const gradeService = {
  async saveExamRecords(req: AuthenticatedRequest, input: ExamSaveInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, input.studentId);
    const semester = parseSemesterLabel(input.semester);
    const examType = input.examType === "중간고사" ? "MIDTERM" : "FINAL";

    await gradeRepository.replaceExamRecords({
      studentProfileId,
      academicYear: semester.academicYear,
      semesterTerm: semester.semesterTerm,
      semesterLabel: input.semester,
      examType,
      subjects: input.subjects
    });

    setAuditContext(req, {
      action: "GRADE_EXAM_UPSERT",
      resourceType: "grade-exam-record",
      resourceId: studentProfileId,
      afterJson: {
        semester: input.semester,
        examType,
        subjectCount: input.subjects.length
      }
    });

    return { saved: true };
  },

  async saveSemesterFinals(req: AuthenticatedRequest, input: SemesterFinalSaveInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, input.studentId);
    const semester = parseSemesterLabel(input.semester);

    await gradeRepository.replaceSemesterFinalGrades({
      studentProfileId,
      academicYear: semester.academicYear,
      semesterTerm: semester.semesterTerm,
      semesterLabel: input.semester,
      averageGrade: buildAverageGrade(input.subjects),
      subjects: input.subjects
    });

    setAuditContext(req, {
      action: "GRADE_FINAL_UPSERT",
      resourceType: "semester-final-grade",
      resourceId: studentProfileId,
      afterJson: {
        semester: input.semester,
        subjectCount: input.subjects.length
      }
    });

    return { saved: true };
  },

  async saveMockExamResults(req: AuthenticatedRequest, input: MockExamSaveInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, input.studentId);
    const examMonth = parseMockMonth(input.semester);
    const examLabel = `${input.semester} 모의`;

    await gradeRepository.replaceMockExamResults({
      studentProfileId,
      academicYear: parseAcademicYear(input.semester),
      examMonth,
      examLabel,
      subjects: input.subjects
    });

    setAuditContext(req, {
      action: "GRADE_MOCK_UPSERT",
      resourceType: "mock-exam-result",
      resourceId: studentProfileId,
      afterJson: {
        semester: input.semester,
        examMonth,
        subjectCount: input.subjects.length
      }
    });

    return { saved: true };
  },

  async getChart(req: AuthenticatedRequest, query: GradeQueryInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, query.studentId);

    if (query.mode === "exam") {
      const rows = await gradeRepository.listExamRecords(studentProfileId);
      const grouped = new Map<string, Record<string, string | number>>();
      const subjects = new Set<string>();

      for (const row of rows) {
        const examLabel = row.examType === "MIDTERM" ? "중간" : "기말";
        const key = `${row.academicYear}-${semesterOrder(row.semesterTerm)}-${row.examType}`;
        if (!grouped.has(key)) {
          grouped.set(key, { period: `${row.semesterLabel} ${examLabel}` });
        }
        grouped.get(key)![row.subjectName] = row.score;
        subjects.add(row.subjectName);
      }

      return {
        data: Array.from(grouped.values()),
        lines: makeLines(Array.from(subjects)),
        hasRealData: rows.length > 0
      };
    }

    if (query.mode === "practice") {
      const rows = await gradeRepository.listMockExamResults(studentProfileId);
      const grouped = new Map<string, Record<string, string | number>>();
      const subjects = new Set<string>();

      for (const row of rows) {
        const key = `${row.academicYear}-${row.examMonth}-${row.examLabel}`;
        if (!grouped.has(key)) {
          grouped.set(key, { period: row.examLabel });
        }
        if (typeof row.grade === "number") {
          grouped.get(key)![row.subjectName] = row.grade;
          subjects.add(row.subjectName);
        }
      }

      return {
        data: Array.from(grouped.values()),
        lines: makeLines(Array.from(subjects)),
        hasRealData: rows.length > 0
      };
    }

    const rows = await gradeRepository.listSemesterFinalGrades(studentProfileId);
    const grouped = new Map<string, Record<string, string | number>>();
    const subjects = new Set<string>();

    for (const row of rows) {
      const key = `${row.academicYear}-${semesterOrder(row.semesterTerm)}`;
      if (!grouped.has(key)) {
        grouped.set(key, { period: row.semesterLabel });
      }
      grouped.get(key)![row.subjectName] = row.finalGrade;
      subjects.add(row.subjectName);
    }

    return {
      data: Array.from(grouped.values()),
      lines: makeLines(Array.from(subjects)),
      hasRealData: rows.length > 0
    };
  },

  async getGrowthReport(req: AuthenticatedRequest, query: GradeQueryInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, query.studentId);
    const finalGrades = await gradeRepository.listSemesterFinalGrades(studentProfileId, "desc");

    if (finalGrades.length === 0) {
      return {
        avgFinalGrade: null,
        bestSubject: null,
        worstSubject: null,
        latestSubjects: [],
        hasRealData: false
      };
    }

    const latest = finalGrades.filter((item) => {
      const maxYear = finalGrades[0]!.academicYear;
      const maxTerm = finalGrades[0]!.semesterTerm;
      return item.academicYear === maxYear && item.semesterTerm === maxTerm;
    });

    const values = latest.map((item) => ({ name: item.subjectName, grade: item.finalGrade }));
    const avg = values.reduce((total, item) => total + item.grade, 0) / values.length;
    const best = values.reduce((prev, current) => (prev.grade < current.grade ? prev : current));
    const worst = values.reduce((prev, current) => (prev.grade > current.grade ? prev : current));

    return {
      avgFinalGrade: Number(avg.toFixed(2)),
      bestSubject: best,
      worstSubject: worst,
      latestSubjects: latest.map((item) => ({
        name: item.subjectName,
        finalGrade: String(item.finalGrade),
        credit: String(item.credit)
      })),
      hasRealData: true
    };
  }
};
