import { ApiError } from "../common/http";
import { careerCounselingRepository } from "./career-counseling.repository";
import { subscriptionService } from "./subscription.service";
import type { CreateSessionInput, SendMessageInput } from "./career-counseling.validator";

const INITIAL_QUESTIONS = [
  "안녕! 진로 상담을 시작해볼게. 요즘 어떤 과목이나 활동을 할 때 시간이 빨리 간다고 느껴?",
  "반대로, 억지로 하게 되는 활동이나 피하고 싶은 일이 있어?",
  "문제를 풀 때 혼자 깊게 파고드는 편이야, 아니면 사람들과 이야기하면서 풀 때 더 잘 풀려?",
  "성적과 상관없이 오래 해보고 싶은 주제가 있어?",
  "사람을 돕는 일, 무언가를 만드는 일, 분석하는 일, 표현하는 일 중 어디에 더 끌려?",
  "왜 그렇게 느꼈는지 최근 경험 하나만 말해줄래?",
  "네가 잘한다고 느끼는 활동과, 남들이 잘한다고 말해준 활동이 같아? 다르다면 뭐가 다를까?",
  "미래에 어떤 환경에서 일하고 싶어? (혼자 집중 / 팀 협업 / 야외 활동 / 사람 만남 등)",
  "지금까지 얘기를 정리해보면 몇 가지 가능성이 보이는데, 이 중 어떤 설명이 너에게 더 가깝게 느껴져?"
];

export const SIGNAL_CATEGORIES = [
  "interests", "disliked_activities", "favorite_subjects", "disliked_subjects",
  "strengths", "weaknesses", "values", "preferred_work_style",
  "social_preference", "problem_solving_style", "career_constraints",
  "motivation_level", "uncertainty_level"
] as const;

export const careerCounselingService = {
  async createSession(userId: string, studentProfileId: string, input: CreateSessionInput) {
    const access = await subscriptionService.checkAccess(userId);
    if (!access.hasAccess) {
      throw new ApiError(403, "FORBIDDEN", access.reason ?? "Subscription required for AI counseling.");
    }

    const session = await careerCounselingRepository.createSession(studentProfileId, input.title ?? undefined);

    const firstQuestion = INITIAL_QUESTIONS[0]!;
    await careerCounselingRepository.addMessage(session.id, "AI", firstQuestion);

    return { session, firstMessage: firstQuestion };
  },

  async getSession(sessionId: string, studentProfileId: string) {
    const session = await careerCounselingRepository.findSessionById(sessionId);
    if (!session || session.studentProfileId !== studentProfileId) {
      throw new ApiError(404, "NOT_FOUND", "Session not found.");
    }
    return session;
  },

  async listSessions(studentProfileId: string) {
    return careerCounselingRepository.findSessionsByStudent(studentProfileId);
  },

  async sendMessage(userId: string, sessionId: string, studentProfileId: string, input: SendMessageInput) {
    const session = await careerCounselingRepository.findSessionById(sessionId);
    if (!session || session.studentProfileId !== studentProfileId) {
      throw new ApiError(404, "NOT_FOUND", "Session not found.");
    }
    if (session.status === "COMPLETED" || session.status === "ARCHIVED") {
      throw new ApiError(409, "CONFLICT", "Session is already completed.");
    }

    await careerCounselingRepository.addMessage(sessionId, "STUDENT", input.content);

    const aiResponse = await this.generateAiResponse(session, input.content);

    await careerCounselingRepository.addMessage(sessionId, "AI", aiResponse.message, aiResponse.signals);

    if (aiResponse.signals && aiResponse.signals.length > 0) {
      for (const signal of aiResponse.signals) {
        await careerCounselingRepository.addSignal(
          sessionId,
          signal.category,
          signal.value,
          signal.evidence,
          signal.confidence
        );
      }
    }

    if (aiResponse.hypotheses && aiResponse.hypotheses.length > 0) {
      for (const hyp of aiResponse.hypotheses) {
        await careerCounselingRepository.createHypothesis(sessionId, hyp);
      }
    }

    const newStep = session.currentStep + 1;
    const newConfidence = aiResponse.confidenceScore ?? session.confidenceScore;
    const newStatus = newConfidence >= 0.8 && newStep >= 5 ? "READY_FOR_REPORT" as const : "ACTIVE" as const;

    await careerCounselingRepository.updateSessionStatus(sessionId, newStatus, newConfidence);

    await careerCounselingRepository.logAiUsage(
      userId,
      sessionId,
      "CAREER_COUNSELING_MESSAGE",
      aiResponse.tokenCount ?? 0,
      aiResponse.modelName
    );

    return {
      message: aiResponse.message,
      signals: aiResponse.signals,
      hypotheses: aiResponse.hypotheses,
      sessionStatus: newStatus,
      confidenceScore: newConfidence,
      step: newStep
    };
  },

  async generateReport(userId: string, sessionId: string, studentProfileId: string) {
    const session = await careerCounselingRepository.findSessionById(sessionId);
    if (!session || session.studentProfileId !== studentProfileId) {
      throw new ApiError(404, "NOT_FOUND", "Session not found.");
    }
    if (session.status !== "READY_FOR_REPORT" && session.status !== "ACTIVE") {
      throw new ApiError(409, "CONFLICT", "Session is not ready for report generation.");
    }
    if (session.report) {
      return session.report;
    }

    const signals = session.signals ?? [];
    const messages = session.messages ?? [];
    const MIN_SIGNALS = 3;
    const MIN_MESSAGES = 4;
    const MIN_CATEGORIES = 2;

    const uniqueCategories = new Set(signals.map((s: any) => s.category));
    if (signals.length < MIN_SIGNALS || messages.length < MIN_MESSAGES || uniqueCategories.size < MIN_CATEGORIES) {
      throw new ApiError(409, "CONFLICT",
        `보고서 생성을 위한 충분한 정보가 수집되지 않았습니다. ` +
        `최소 ${MIN_SIGNALS}개의 신호(현재 ${signals.length}개), ` +
        `${MIN_MESSAGES}개의 대화(현재 ${messages.length}개), ` +
        `${MIN_CATEGORIES}개 이상의 카테고리(현재 ${uniqueCategories.size}개)가 필요합니다.`
      );
    }

    const report = await this.buildReport(session);

    const created = await careerCounselingRepository.createReport(sessionId, report);
    await careerCounselingRepository.updateSessionStatus(sessionId, "COMPLETED", session.confidenceScore);

    await careerCounselingRepository.logAiUsage(
      userId,
      sessionId,
      "CAREER_REPORT_GENERATION",
      report.tokenCount ?? 0
    );

    return created;
  },

  async getReport(sessionId: string, studentProfileId: string) {
    const session = await careerCounselingRepository.findSessionById(sessionId);
    if (!session || session.studentProfileId !== studentProfileId) {
      throw new ApiError(404, "NOT_FOUND", "Session not found.");
    }
    const report = await careerCounselingRepository.getReport(sessionId);
    if (!report) {
      throw new ApiError(404, "NOT_FOUND", "Report not yet generated.");
    }
    return report;
  },

  async generateAiResponse(session: any, userMessage: string) {
    const step = session.currentStep;

    const nextQuestionIndex = Math.min(step + 1, INITIAL_QUESTIONS.length - 1);
    const baseQuestion = INITIAL_QUESTIONS[nextQuestionIndex] ?? "지금까지 대화를 바탕으로 정리해볼게.";

    const signals = this.extractBasicSignals(userMessage, step);

    let confidenceScore = Math.min(0.1 * (step + 1), 0.9);
    if (signals.length > 0) {
      confidenceScore = Math.min(confidenceScore + 0.05 * signals.length, 0.95);
    }

    const hypotheses = step >= 3 ? this.generateBasicHypotheses(session.signals ?? [], signals) : [];

    let message = baseQuestion;
    if (hypotheses.length > 0 && step >= 5) {
      const careerNames = hypotheses.map((h: any) => h.careerName).join(", ");
      message = `지금까지 네 답변을 보면 ${careerNames} 쪽 가능성이 보여. ${baseQuestion}`;
    }

    return {
      message,
      signals,
      hypotheses,
      confidenceScore,
      tokenCount: Math.round(userMessage.length * 1.5 + message.length * 1.5),
      modelName: "career-counseling-engine"
    };
  },

  extractBasicSignals(content: string, _step: number) {
    const signals: Array<{ category: string; value: string; evidence?: string; confidence?: number }> = [];

    const interestKeywords = ["좋아", "재밌", "흥미", "관심", "빠져"];
    const dislikeKeywords = ["싫", "지루", "억지", "피하"];
    const strengthKeywords = ["잘하", "자신", "칭찬"];

    if (interestKeywords.some(k => content.includes(k))) {
      signals.push({ category: "interests", value: content.slice(0, 100), evidence: content, confidence: 0.6 });
    }
    if (dislikeKeywords.some(k => content.includes(k))) {
      signals.push({ category: "disliked_activities", value: content.slice(0, 100), evidence: content, confidence: 0.6 });
    }
    if (strengthKeywords.some(k => content.includes(k))) {
      signals.push({ category: "strengths", value: content.slice(0, 100), evidence: content, confidence: 0.5 });
    }

    return signals;
  },

  generateBasicHypotheses(existingSignals: any[], newSignals: any[]) {
    const allSignals = [...existingSignals, ...newSignals];
    if (allSignals.length < 3) return [];

    return [
      {
        careerName: "탐색 중",
        relatedMajors: [],
        reason: "아직 충분한 대화가 이루어지지 않아 구체적 추천을 하기 어려워요. 대화를 더 이어가면 정확한 가설을 세울 수 있어요.",
        supportingEvidence: allSignals.map((s: any) => s.value ?? s.category).slice(0, 5),
        missingInformation: ["선호 업무 환경", "가치관 우선순위", "구체적 경험 사례"],
        confidenceScore: 0.3
      }
    ];
  },

  async buildReport(session: any) {
    const signals = session.signals ?? [];
    const hypotheses = session.hypotheses ?? [];
    const messages = session.messages ?? [];

    const summary = `총 ${messages.length}회의 대화를 통해 학생의 진로 관련 신호 ${signals.length}개를 수집했습니다. ` +
      `현재 자신감 점수는 ${(session.confidenceScore * 100).toFixed(0)}%입니다.`;

    return {
      summary,
      recommendedCareers: hypotheses.map((h: any) => ({
        name: h.careerName,
        reason: h.reason,
        confidence: h.confidenceScore
      })),
      recommendedMajors: hypotheses.flatMap((h: any) => h.relatedMajors ?? []),
      strengths: signals.filter((s: any) => s.category === "strengths").map((s: any) => s.value),
      risks: signals.filter((s: any) => s.category === "weaknesses").map((s: any) => s.value),
      studyPlan: null,
      nextQuestions: ["더 구체적인 경험을 나눠보면 좋겠어요.", "관심 분야의 직업인 인터뷰를 읽어보는 건 어때요?"],
      evidence: {
        signalCount: signals.length,
        messageCount: messages.length,
        hypothesisCount: hypotheses.length,
        categories: [...new Set(signals.map((s: any) => s.category))]
      },
      disclaimer: "이 보고서는 AI 대화를 기반으로 한 탐색 결과이며, 전문 진로 상담사의 판단을 대체하지 않습니다. " +
        "대화 내용에 근거한 가능성을 제시한 것이므로, 추가적인 탐색과 전문 상담을 권장합니다.",
      tokenCount: 500
    };
  }
};
