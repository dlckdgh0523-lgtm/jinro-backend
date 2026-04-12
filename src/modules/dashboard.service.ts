import { prisma } from "../infra/prisma";
import type { AuthenticatedRequest } from "../infra/security";
import { ApiError } from "../common/http";
import {
  buildGoalLabel,
  buildStatusFromSignals,
  dbTrackToFront,
  ensureTeacherProfileId,
  formatRelativeTimeKo,
  getCurrentWeekRange,
  resolveStudentProfileId,
  todayLabelKo
} from "../common/domain";
import { dashboardRepository } from "./dashboard.repository";
import type { StudentListQueryInput } from "./dashboard.validator";

const NO_GOAL_LABEL = "誘몄꽕??";

const average = (values: number[]) =>
  values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));

const serializeAlert = (notification: {
  id: string;
  type: "DANGER" | "WARNING" | "INFO" | "SUCCESS";
  category: string;
  title: string;
  body: string;
  status: "UNREAD" | "READ" | "DISMISSED";
  createdAt: Date;
}) => ({
  id: notification.id,
  type:
    notification.type === "DANGER"
      ? "danger"
      : notification.type === "WARNING"
        ? "warning"
        : notification.type === "SUCCESS"
          ? "success"
          : "info",
  category: notification.category,
  title: notification.title,
  body: notification.body,
  time: formatRelativeTimeKo(notification.createdAt),
  read: notification.status !== "UNREAD"
});

const requestTypeToFront = (value: "ACADEMIC" | "CAREER" | "EMOTIONAL" | "OTHER") => {
  if (value === "ACADEMIC") return "?숈뾽 怨좊?";
  if (value === "CAREER") return "吏꾨줈 怨좊?";
  if (value === "EMOTIONAL") return "?뺤꽌??吏??";
  return "湲고?";
};

const buildStudentCard = async (studentProfileId: string) => {
  const { weekStart } = getCurrentWeekRange();
  const student = await dashboardRepository.findStudentCardData(studentProfileId, weekStart);

  if (!student) {
    throw new ApiError(404, "NOT_FOUND", "Student not found.");
  }

  const latestPlan = student.studyPlans[0];
  const tasks = latestPlan?.tasks ?? [];
  const completionRate =
    tasks.length === 0 ? 0 : Math.round((tasks.filter((item) => item.done).length / tasks.length) * 100);

  const gpa = average(student.semesterFinalGrades.map((item) => item.finalGrade));
  const goal = student.goalSettings[0];
  const hasGoal = Boolean(goal);
  const status = buildStatusFromSignals(gpa || null, completionRate, hasGoal);

  return {
    id: student.id,
    name: student.displayName,
    grade: `${student.gradeLevel}?숇뀈`,
    track: dbTrackToFront(student.track),
    gpa,
    goal: goal ? buildGoalLabel(goal.universityNameSnapshot, goal.departmentNameSnapshot) : NO_GOAL_LABEL,
    status,
    completion: completionRate,
    counselNeeded: student.counselingRequests.length > 0 || status !== "normal",
    hasGoal
  };
};

export const dashboardService = {
  async listStudents(req: AuthenticatedRequest, query: StudentListQueryInput) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const assignments = await dashboardRepository.listAssignedStudentProfileIds(teacherProfileId);
    const allStudents = await Promise.all(assignments.map((item) => buildStudentCard(item.studentProfileId)));

    return allStudents
      .filter((student) => {
        if (query.search && !student.name.includes(query.search)) return false;
        if (query.status && student.status !== query.status) return false;
        return true;
      })
      .map(({ hasGoal: _hasGoal, ...student }) => student);
  },

  async getStudentDetail(req: AuthenticatedRequest, studentId: string) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const assignment = await dashboardRepository.findTeacherStudentAssignment(teacherProfileId, studentId);

    if (!assignment) {
      throw new ApiError(404, "NOT_FOUND", "Student not found for this teacher.");
    }

    const student = await dashboardRepository.findStudentWithUser(studentId);
    if (!student) {
      throw new ApiError(404, "NOT_FOUND", "Student not found.");
    }

    const studentCard = await buildStudentCard(studentId);
    const [alerts, memos] = await Promise.all([
      dashboardRepository.listNotificationsForUser(student.user.id, 3),
      dashboardRepository.listRecentMemos(studentId, 3)
    ]);

    return {
      student: (({ hasGoal: _hasGoal, ...card }) => card)(studentCard),
      alerts: alerts.map(serializeAlert),
      recentMemos: memos.map((memo) => ({
        id: memo.id,
        teacher: memo.teacherProfile.displayName,
        date: memo.createdAt.toISOString().slice(0, 10),
        subject: memo.title,
        content: memo.content
      }))
    };
  },

  async getTeacherMe(req: AuthenticatedRequest) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const teacher = await dashboardRepository.findTeacherProfile(teacherProfileId);

    if (!teacher) {
      throw new ApiError(404, "NOT_FOUND", "Teacher not found.");
    }

    return {
      id: teacher.id,
      name: teacher.displayName,
      schoolName: teacher.schoolName,
      subjectAreas: teacher.subjectAreas,
      inviteCode: teacher.homeroomClassRooms[0]?.inviteCode ?? null
    };
  },

  async getClassroom(req: AuthenticatedRequest) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const classroom = await dashboardRepository.findTeacherClassroom(teacherProfileId);

    if (!classroom) {
      throw new ApiError(404, "NOT_FOUND", "Classroom not found.");
    }

    return {
      id: classroom.id,
      schoolName: classroom.schoolName,
      academicYear: classroom.academicYear,
      grade: `${classroom.gradeLevel}?숇뀈`,
      className: `${classroom.classNumber}諛?`,
      inviteCode: classroom.inviteCode
    };
  },

  async getStudentDashboard(req: AuthenticatedRequest) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!);
    const { weekStart } = getCurrentWeekRange();
    const student = await dashboardRepository.findStudentDashboardData(studentProfileId, weekStart);

    const plan = student.studyPlans[0];
    const tasks = plan?.tasks ?? [];
    const completion =
      tasks.length === 0 ? 0 : Math.round((tasks.filter((item) => item.done).length / tasks.length) * 100);
    const goal = student.goalSettings[0];
    const gpa = average(student.semesterFinalGrades.map((item) => item.finalGrade));

    return {
      greetingName: student.displayName,
      todayLabel: todayLabelKo(),
      stats: {
        averageGrade: gpa,
        weeklyCompletion: completion,
        goalProgress: goal ? 75 : 0,
        unreadAlerts: student.user.notifications.filter((item) => item.status === "UNREAD").length
      },
      todayTasks: tasks.slice(0, 4).map((task) => ({
        id: task.id,
        subject: task.subject,
        task: task.task,
        day: task.dayLabel,
        priority: task.priority === "HIGH" ? "high" : task.priority === "LOW" ? "low" : "medium",
        done: task.done
      })),
      recentAlerts: student.user.notifications.slice(0, 3).map(serializeAlert),
      goalSummary: goal
        ? {
            university: goal.universityNameSnapshot,
            department: goal.departmentNameSnapshot,
            targetGrade: goal.targetGrade,
            targetScore: goal.targetScore
          }
        : null
    };
  },

  async getTeacherDashboard(req: AuthenticatedRequest) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const [classroom, assignments, requests] = await Promise.all([
      dashboardRepository.findTeacherClassroom(teacherProfileId),
      dashboardRepository.listAssignedStudentProfileIds(teacherProfileId),
      dashboardRepository.listTeacherCounselingRequests(teacherProfileId, 5)
    ]);

    const students = await Promise.all(assignments.map((item) => buildStudentCard(item.studentProfileId)));

    return {
      classroom: classroom
        ? {
            schoolName: classroom.schoolName,
            grade: `${classroom.gradeLevel}?숇뀈`,
            className: `${classroom.classNumber}諛?`,
            inviteCode: classroom.inviteCode,
            studentCount: students.length
          }
        : null,
      stats: {
        totalStudents: students.length,
        counselNeeded: students.filter((item) => item.counselNeeded).length,
        noGoal: students.filter((item) => !item.hasGoal).length,
        lowCompletion: students.filter((item) => item.completion < 50).length
      },
      students: students
        .filter((item) => item.status !== "normal")
        .map(({ hasGoal: _hasGoal, ...student }) => student),
      counselingRequests: requests.map((item) => ({
        id: item.id,
        student: item.studentProfile.displayName,
        type: requestTypeToFront(item.type),
        date: item.requestedAt.toISOString().slice(0, 10),
        status:
          item.status === "IN_PROGRESS" ? "in_progress" : item.status === "COMPLETED" ? "completed" : "pending"
      }))
    };
  },

  async getCompletionStatus(req: AuthenticatedRequest) {
    const teacherProfileId = await ensureTeacherProfileId(prisma, req.auth!);
    const assignments = await dashboardRepository.listAssignedStudentProfileIds(teacherProfileId);
    const students = await Promise.all(assignments.map((item) => buildStudentCard(item.studentProfileId)));
    const lowStudents = students
      .filter((item) => item.completion < 50)
      .sort((left, right) => left.completion - right.completion)
      .map(({ hasGoal: _hasGoal, ...student }) => student);
    const plans = await dashboardRepository.listStudyPlansForStudents(
      assignments.map((item) => item.studentProfileId)
    );

    const trendMap = new Map<string, number[]>();
    for (const plan of plans) {
      const key = `${plan.weekStartDate.getMonth() + 1}/${Math.ceil(plan.weekStartDate.getDate() / 7)}二?`;
      trendMap.set(key, [...(trendMap.get(key) ?? []), plan.completionRate]);
    }

    return {
      summary: {
        classAverageCompletion: average(students.map((item) => item.completion)),
        highCompletionStudents: students.filter((item) => item.completion >= 80).length,
        mediumCompletionStudents: students.filter((item) => item.completion >= 50 && item.completion < 80).length,
        lowCompletionStudents: lowStudents.length
      },
      trend: Array.from(trendMap.entries()).map(([week, values]) => ({
        week,
        "완료율": Math.round(average(values))
      })),
      lowStudents
    };
  }
};
