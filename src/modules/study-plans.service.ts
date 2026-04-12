import { setAuditContext } from "../infra/audit";
import { sseBroker } from "../infra/realtime";
import type { AuthenticatedRequest } from "../infra/security";
import { ApiError } from "../common/http";
import {
  dbPriorityToFront,
  frontPriorityToDb,
  getCurrentWeekRange,
  getDayOrder,
  resolveStudentProfileId
} from "../common/domain";
import { prisma } from "../infra/prisma";
import { studyPlanRepository } from "./study-plans.repository";
import type { CreateTaskInput, UpdateTaskInput } from "./study-plans.validator";

const serializeTask = (task: {
  id: string;
  subject: string;
  task: string;
  dayLabel: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  done: boolean;
}) => ({
  id: task.id,
  subject: task.subject,
  task: task.task,
  day: task.dayLabel,
  priority: dbPriorityToFront(task.priority),
  done: task.done
});

export const studyPlanService = {
  async getCurrentPlan(req: AuthenticatedRequest, requestedStudentId?: string) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, requestedStudentId);
    const { weekStart, weekEnd } = getCurrentWeekRange();
    const plan = await studyPlanRepository.getCurrentPlan(studentProfileId, weekStart, weekEnd);

    return {
      planId: plan.id,
      weekStartDate: plan.weekStartDate.toISOString(),
      weekEndDate: plan.weekEndDate.toISOString(),
      tasks: plan.tasks.map(serializeTask),
      completion: {
        percentage: plan.completionRate,
        completedCount: plan.tasks.filter((item) => item.done).length,
        totalCount: plan.tasks.length
      }
    };
  },

  async createTask(req: AuthenticatedRequest, input: CreateTaskInput) {
    const studentProfileId = await resolveStudentProfileId(prisma, req.auth!, input.studentId);
    const { weekStart, weekEnd } = getCurrentWeekRange();
    const plan = await studyPlanRepository.getCurrentPlan(studentProfileId, weekStart, weekEnd);

    const task = await studyPlanRepository.createTask({
      studyPlanId: plan.id,
      subject: input.subject,
      task: input.task,
      dayLabel: input.day,
      dayOrder: getDayOrder(input.day),
      priority: frontPriorityToDb(input.priority),
      orderIndex: plan.tasks.length
    });

    await studyPlanRepository.recomputeCompletion(plan.id);
    sseBroker.publishToUser(plan.studentProfile.userId, "study-plan.updated", {
      studyPlanId: plan.id,
      taskId: task.id
    });

    setAuditContext(req, {
      action: "STUDY_TASK_CREATE",
      resourceType: "study-task",
      resourceId: task.id,
      afterJson: serializeTask(task)
    });

    return serializeTask(task);
  },

  async updateTask(req: AuthenticatedRequest, taskId: string, input: UpdateTaskInput) {
    const targetTask = await studyPlanRepository.findTaskWithPlan(taskId);

    if (!targetTask || targetTask.deletedAt) {
      throw new ApiError(404, "NOT_FOUND", "Study task not found.");
    }

    const studentProfileId = await resolveStudentProfileId(
      prisma,
      req.auth!,
      input.studentId ?? targetTask.studyPlan.studentProfile.id
    );

    if (studentProfileId !== targetTask.studyPlan.studentProfile.id) {
      throw new ApiError(403, "FORBIDDEN", "Cannot update another student's task.");
    }

    const updatedTask = await studyPlanRepository.updateTask(targetTask.id, {
      subject: input.subject ?? undefined,
      task: input.task ?? undefined,
      dayLabel: input.day ?? undefined,
      dayOrder: input.day ? getDayOrder(input.day) : undefined,
      priority: input.priority ? frontPriorityToDb(input.priority) : undefined,
      done: input.done ?? undefined,
      completedAt: input.done === true ? new Date() : input.done === false ? null : undefined
    });

    await studyPlanRepository.recomputeCompletion(targetTask.studyPlanId);
    sseBroker.publishToUser(targetTask.studyPlan.studentProfile.userId, "study-plan.updated", {
      studyPlanId: targetTask.studyPlanId,
      taskId: updatedTask.id,
      done: updatedTask.done
    });

    setAuditContext(req, {
      action: "STUDY_TASK_UPDATE",
      resourceType: "study-task",
      resourceId: updatedTask.id,
      beforeJson: {
        subject: targetTask.subject,
        task: targetTask.task,
        done: targetTask.done
      },
      afterJson: serializeTask(updatedTask)
    });

    return serializeTask(updatedTask);
  },

  async deleteTask(req: AuthenticatedRequest, taskId: string, requestedStudentId?: string) {
    const targetTask = await studyPlanRepository.findTaskWithPlan(taskId);

    if (!targetTask || targetTask.deletedAt) {
      throw new ApiError(404, "NOT_FOUND", "Study task not found.");
    }

    const studentProfileId = await resolveStudentProfileId(
      prisma,
      req.auth!,
      requestedStudentId ?? targetTask.studyPlan.studentProfile.id
    );

    if (studentProfileId !== targetTask.studyPlan.studentProfile.id) {
      throw new ApiError(403, "FORBIDDEN", "Cannot delete another student's task.");
    }

    await studyPlanRepository.softDeleteTask(targetTask.id);
    await studyPlanRepository.recomputeCompletion(targetTask.studyPlanId);

    sseBroker.publishToUser(targetTask.studyPlan.studentProfile.userId, "study-plan.updated", {
      studyPlanId: targetTask.studyPlanId,
      taskId: targetTask.id,
      deleted: true
    });

    setAuditContext(req, {
      action: "STUDY_TASK_DELETE",
      resourceType: "study-task",
      resourceId: targetTask.id,
      beforeJson: {
        subject: targetTask.subject,
        task: targetTask.task
      }
    });

    return { deleted: true };
  }
};
