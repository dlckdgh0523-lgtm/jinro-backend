import { prisma } from "../infra/prisma";
import type { CounselingSessionStatus } from "@prisma/client";

export const careerCounselingRepository = {
  createSession(studentProfileId: string, title?: string) {
    return prisma.careerCounselingSession.create({
      data: { studentProfileId, title }
    });
  },

  findSessionById(sessionId: string) {
    return prisma.careerCounselingSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        signals: true,
        hypotheses: { where: { active: true } },
        report: true
      }
    });
  },

  findSessionsByStudent(studentProfileId: string) {
    return prisma.careerCounselingSession.findMany({
      where: { studentProfileId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        title: true,
        currentStep: true,
        confidenceScore: true,
        createdAt: true,
        updatedAt: true
      }
    });
  },

  addMessage(sessionId: string, role: "STUDENT" | "AI" | "SYSTEM_NOTE", content: string, extractedSignals?: unknown) {
    return prisma.careerCounselingMessage.create({
      data: { sessionId, role, content, extractedSignals: extractedSignals as any }
    });
  },

  addSignal(sessionId: string, category: string, value: string, evidence?: string, confidence?: number) {
    return prisma.careerSignal.create({
      data: { sessionId, category, value, evidence, confidence: confidence ?? 0.5 }
    });
  },

  upsertHypothesis(sessionId: string, careerName: string, data: {
    relatedMajors?: string[];
    reason: string;
    supportingEvidence?: string[];
    missingInformation?: string[];
    confidenceScore?: number;
  }) {
    return prisma.careerHypothesis.upsert({
      where: { id: `${sessionId}_${careerName}` },
      create: {
        sessionId,
        careerName,
        relatedMajors: data.relatedMajors ?? [],
        reason: data.reason,
        supportingEvidence: data.supportingEvidence ?? [],
        missingInformation: data.missingInformation ?? [],
        confidenceScore: data.confidenceScore ?? 0
      },
      update: {
        reason: data.reason,
        supportingEvidence: data.supportingEvidence ?? [],
        missingInformation: data.missingInformation ?? [],
        confidenceScore: data.confidenceScore ?? 0,
        relatedMajors: data.relatedMajors ?? []
      }
    });
  },

  createHypothesis(sessionId: string, data: {
    careerName: string;
    relatedMajors?: string[];
    reason: string;
    supportingEvidence?: string[];
    missingInformation?: string[];
    confidenceScore?: number;
  }) {
    return prisma.careerHypothesis.create({
      data: {
        sessionId,
        careerName: data.careerName,
        relatedMajors: data.relatedMajors ?? [],
        reason: data.reason,
        supportingEvidence: data.supportingEvidence ?? [],
        missingInformation: data.missingInformation ?? [],
        confidenceScore: data.confidenceScore ?? 0
      }
    });
  },

  updateSessionStatus(sessionId: string, status: CounselingSessionStatus, confidenceScore?: number) {
    return prisma.careerCounselingSession.update({
      where: { id: sessionId },
      data: {
        status,
        confidenceScore,
        currentStep: { increment: 1 },
        completedAt: status === "COMPLETED" ? new Date() : undefined
      }
    });
  },

  createReport(sessionId: string, data: {
    summary: string;
    recommendedCareers: unknown;
    recommendedMajors: unknown;
    strengths: string[];
    risks: string[];
    studyPlan?: unknown;
    nextQuestions: string[];
    evidence: unknown;
    disclaimer: string;
  }) {
    return prisma.careerReport.create({
      data: {
        sessionId,
        summary: data.summary,
        recommendedCareers: data.recommendedCareers as any,
        recommendedMajors: data.recommendedMajors as any,
        strengths: data.strengths,
        risks: data.risks,
        studyPlan: data.studyPlan as any,
        nextQuestions: data.nextQuestions,
        evidence: data.evidence as any,
        disclaimer: data.disclaimer
      }
    });
  },

  getReport(sessionId: string) {
    return prisma.careerReport.findUnique({ where: { sessionId } });
  },

  logAiUsage(userId: string, sessionId: string, actionType: string, tokenCount: number, modelName?: string) {
    return prisma.aiUsageLog.create({
      data: { userId, sessionId, actionType, tokenCount, modelName }
    });
  }
};
