import type { PrismaClient, SemesterTerm, StudyTaskPriority, TrackType } from "@prisma/client";
import type { AuthClaims } from "../infra/security";
import { ApiError } from "./http";

const DAY_ORDER_MAP: Record<string, number> = {
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
  일: 7
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export const getDayOrder = (label: string) => DAY_ORDER_MAP[label] ?? 1;

export const getCurrentWeekRange = (anchor = new Date()) => {
  const current = new Date(anchor);
  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const weekStart = new Date(current);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(current.getDate() + diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
};

export const formatRelativeTimeKo = (input: Date) => {
  const now = Date.now();
  const diffMs = now - input.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    return `${Math.max(1, Math.floor(diffMs / minute))}분 전`;
  }

  if (diffMs < day) {
    return `${Math.max(1, Math.floor(diffMs / hour))}시간 전`;
  }

  if (diffMs < day * 7) {
    return `${Math.max(1, Math.floor(diffMs / day))}일 전`;
  }

  return input.toISOString().slice(0, 10);
};

export const frontTrackToDb = (track: string): TrackType => {
  if (track.includes("공학") || track.includes("이과")) return "STEM";
  if (track.includes("인문") || track.includes("문과")) return "HUMANITIES";
  if (track.includes("예체능")) return "ARTS";
  return "UNDECIDED";
};

export const dbTrackToFront = (track: TrackType) => {
  switch (track) {
    case "STEM":
      return "공학계열";
    case "HUMANITIES":
      return "인문계열";
    case "ARTS":
      return "예체능계열";
    default:
      return "미정";
  }
};

export const frontPriorityToDb = (priority: string): StudyTaskPriority => {
  if (priority === "high") return "HIGH";
  if (priority === "low") return "LOW";
  return "MEDIUM";
};

export const dbPriorityToFront = (priority: StudyTaskPriority) => {
  switch (priority) {
    case "HIGH":
      return "high";
    case "LOW":
      return "low";
    default:
      return "medium";
  }
};

export const parseSemesterLabel = (
  semesterLabel: string
): { academicYear: number; semesterTerm: SemesterTerm } => {
  const yearMatch = semesterLabel.match(/(\d{4})/);
  const termMatch = semesterLabel.match(/([12])\s*학기/);

  if (!yearMatch || !termMatch) {
    throw new ApiError(400, "VALIDATION_ERROR", `Invalid semester label: ${semesterLabel}`);
  }

  return {
    academicYear: Number(yearMatch[1]),
    semesterTerm: termMatch[1] === "1" ? "FIRST" : "SECOND"
  };
};

export const parseMockMonth = (semesterLabel: string) => {
  const monthMatch = semesterLabel.match(/(\d{1,2})\s*월/);
  return monthMatch ? Number(monthMatch[1]) : 0;
};

export const buildGoalLabel = (universityName: string, departmentName: string) =>
  `${universityName} ${departmentName}`.trim();

export const buildStatusFromSignals = (
  gpa: number | null,
  completionRate: number,
  goalExists: boolean
) => {
  if ((gpa !== null && gpa >= 3) || completionRate < 40) return "danger";
  if ((gpa !== null && gpa >= 2.2) || completionRate < 70 || !goalExists) return "warning";
  return "normal";
};

export const ensureTeacherProfileId = async (prisma: PrismaClient, auth: AuthClaims) => {
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "Teacher role is required.");
  }

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: auth.sub },
    select: { id: true }
  });

  if (!teacher) {
    throw new ApiError(404, "NOT_FOUND", "Teacher profile not found.");
  }

  return teacher.id;
};

export const resolveStudentProfileId = async (
  prisma: PrismaClient,
  auth: AuthClaims,
  requestedStudentProfileId?: string
) => {
  if (auth.role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true }
    });

    if (!student) {
      throw new ApiError(404, "NOT_FOUND", "Student profile not found.");
    }

    if (requestedStudentProfileId && requestedStudentProfileId !== student.id) {
      throw new ApiError(403, "FORBIDDEN", "Students cannot access another student's data.");
    }

    return student.id;
  }

  if (!requestedStudentProfileId) {
    throw new ApiError(400, "VALIDATION_ERROR", "studentId is required for teacher access.");
  }

  const teacherProfileId = await ensureTeacherProfileId(prisma, auth);
  const assignment = await prisma.teacherStudentAssignment.findFirst({
    where: {
      teacherProfileId,
      studentProfileId: requestedStudentProfileId,
      active: true
    },
    select: { id: true }
  });

  if (!assignment && auth.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "Teacher is not assigned to this student.");
  }

  return requestedStudentProfileId;
};

export const makeInviteCode = (academicYear: number, gradeLevel: number, classNumber: number) => {
  const section = String.fromCharCode(64 + Math.max(1, Math.min(classNumber, 26)));
  return `JN-${academicYear}-${gradeLevel}${section}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
};

export const normalizeClassNumber = (input: string | number) => {
  if (typeof input === "number") {
    return input;
  }

  const parsed = Number(input.replace(/[^\d]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `Invalid class number: ${input}`);
  }

  return parsed;
};

export const todayLabelKo = (date = new Date()) =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${DAY_LABELS[date.getDay()]}요일`;
