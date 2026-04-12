import { setAuditContext } from "../infra/audit";
import { prisma } from "../infra/prisma";
import { sseBroker } from "../infra/realtime";
import type { AuthenticatedRequest } from "../infra/security";
import { buildGoalLabel, resolveStudentProfileId } from "../common/domain";
import { goalRepository } from "./goals.repository";
import type { GoalQueryInput, SaveGoalInput } from "./goals.validator";

const serializeGoal = (goal: {
  universityNameSnapshot: string;
  departmentNameSnapshot: string;
  fieldGroup: string;
  targetGrade: number | null;
  targetScore: number | null;
  updatedAt: Date;
  version: number;
}) => ({
  university: goal.universityNameSnapshot,
  department: goal.departmentNameSnapshot,
  field: goal.fieldGroup,
  targetGrade: String(goal.targetGrade ?? ""),
  targetScore: String(goal.targetScore ?? ""),
  savedAt: goal.updatedAt.toISOString(),
  changeCount: Math.max(0, goal.version - 1)
});

const pushTeacherGoalNotifications = async (studentProfileId: string, title: string, body: string) => {
  const student = await goalRepository.findStudentAssignments(studentProfileId);

  if (!student) {
    return;
  }

  for (const assignment of student.assignments) {
    const notification = await goalRepository.createNotification({
      userId: assignment.teacherProfile.userId,
      type: "INFO",
      category: "吏꾨줈",
      title,
      body,
      dedupeKey: `goal:${studentProfileId}:${Date.now()}`
    });

    sseBroker.publishToUser(assignment.teacherProfile.userId, "notification.created", {
      notificationId: notification.id,
      category: notification.category,
      title: notification.title
    });
  }
};

export const goalService = {
  async getCurrent(req: AuthenticatedRequest, query: GoalQueryInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, query.studentId);
    const current = await goalRepository.findCurrentGoal(studentProfileId);

    return current ? serializeGoal(current) : null;
  },

  async saveCurrent(req: AuthenticatedRequest, input: SaveGoalInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, input.studentId);
    const activeGoal = await goalRepository.findCurrentGoal(studentProfileId);
    const university = await goalRepository.upsertUniversity(input.university);
    const existingDepartment = await goalRepository.findStandaloneDepartment(input.department, input.field);
    const department =
      existingDepartment ?? (await goalRepository.createDepartment(input.department, input.field));
    const version = (activeGoal?.version ?? 0) + 1;

    if (activeGoal) {
      await goalRepository.deactivateActiveGoals(studentProfileId);
    }

    const goal = await goalRepository.createGoal({
      studentProfileId,
      fieldGroup: input.field,
      universityId: university.id,
      universityNameSnapshot: input.university,
      departmentId: department.id,
      departmentNameSnapshot: input.department,
      targetGrade: input.targetGrade,
      targetScore: input.targetScore,
      version
    });

    const student = await goalRepository.findStudentName(studentProfileId);
    const goalLabel = buildGoalLabel(input.university, input.department);
    const title =
      version === 1
        ? `${student?.displayName ?? "?숈깮"} ?숈깮 吏꾨줈 紐⑺몴 ?ㅼ젙`
        : `${student?.displayName ?? "?숈깮"} ?숈깮 吏꾨줈 紐⑺몴 蹂寃?(${version - 1}踰덉㎏)`;
    const body =
      version === 1
        ? `${student?.displayName ?? "?숈깮"} ?숈깮??紐⑺몴瑜?${goalLabel}濡??ㅼ젙?덉뒿?덈떎. 紐⑺몴 ?댁떊 ${input.targetGrade}?깃툒 / ?섎뒫 ${input.targetScore}??`
        : `${student?.displayName ?? "?숈깮"} ?숈깮??紐⑺몴瑜?${goalLabel}濡?蹂寃쏀뻽?듬땲??`;

    await pushTeacherGoalNotifications(studentProfileId, title, body);

    setAuditContext(req, {
      action: "GOAL_UPSERT",
      resourceType: "goal-setting",
      resourceId: goal.id,
      afterJson: {
        university: goal.universityNameSnapshot,
        department: goal.departmentNameSnapshot
      }
    });

    return serializeGoal(goal);
  },

  async deleteCurrent(req: AuthenticatedRequest, query: GoalQueryInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, query.studentId);
    await goalRepository.deactivateActiveGoals(studentProfileId);

    setAuditContext(req, {
      action: "GOAL_DELETE",
      resourceType: "goal-setting",
      resourceId: studentProfileId
    });

    return { deleted: true };
  },

  async listOptions() {
    const [universities, departments] = await Promise.all([
      goalRepository.listUniversities(),
      goalRepository.listStandaloneDepartments()
    ]);

    const departmentsByField = departments.reduce<Record<string, string[]>>((acc, item) => {
      const bucket = acc[item.fieldGroup] ?? [];
      bucket.push(item.name);
      acc[item.fieldGroup] = bucket;
      return acc;
    }, {});

    return {
      universities: universities.map((item) => item.name),
      departmentsByField
    };
  }
};
