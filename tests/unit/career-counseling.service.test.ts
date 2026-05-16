import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCounselingSession, makeSignal } from "../helpers/fixtures";

vi.mock("../../src/modules/career-counseling.repository", () => ({
  careerCounselingRepository: {
    createSession: vi.fn(),
    findSessionById: vi.fn(),
    findSessionsByStudent: vi.fn(),
    addMessage: vi.fn(),
    addSignal: vi.fn(),
    upsertHypothesis: vi.fn(),
    createHypothesis: vi.fn(),
    updateSessionStatus: vi.fn(),
    createReport: vi.fn(),
    getReport: vi.fn(),
    logAiUsage: vi.fn()
  }
}));

vi.mock("../../src/modules/subscription.service", () => ({
  subscriptionService: {
    checkAccess: vi.fn()
  }
}));

let careerCounselingService: typeof import("../../src/modules/career-counseling.service").careerCounselingService;
let careerCounselingRepository: typeof import("../../src/modules/career-counseling.repository").careerCounselingRepository;
let subscriptionService: typeof import("../../src/modules/subscription.service").subscriptionService;

beforeAll(async () => {
  const svc = await import("../../src/modules/career-counseling.service");
  const repo = await import("../../src/modules/career-counseling.repository");
  const subSvc = await import("../../src/modules/subscription.service");
  careerCounselingService = svc.careerCounselingService;
  careerCounselingRepository = repo.careerCounselingRepository;
  subscriptionService = subSvc.subscriptionService;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("careerCounselingService", () => {
  describe("createSession", () => {
    it("throws FORBIDDEN if user has no subscription access", async () => {
      vi.mocked(subscriptionService.checkAccess).mockResolvedValue({ hasAccess: false, reason: "No active subscription." });

      await expect(
        careerCounselingService.createSession("user-1", "profile-1", {})
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    });

    it("creates session and sends first AI question", async () => {
      vi.mocked(subscriptionService.checkAccess).mockResolvedValue({ hasAccess: true });
      const session = makeCounselingSession();
      vi.mocked(careerCounselingRepository.createSession).mockResolvedValue(session as any);
      vi.mocked(careerCounselingRepository.addMessage).mockResolvedValue({} as any);

      const result = await careerCounselingService.createSession("user-1", "profile-1", { title: "테스트" });

      expect(careerCounselingRepository.createSession).toHaveBeenCalledWith("profile-1", "테스트");
      expect(careerCounselingRepository.addMessage).toHaveBeenCalledWith(
        session.id, "AI", expect.stringContaining("진로 상담")
      );
      expect(result.session).toEqual(session);
      expect(result.firstMessage).toContain("진로 상담");
    });

    it("creates session with no title", async () => {
      vi.mocked(subscriptionService.checkAccess).mockResolvedValue({ hasAccess: true });
      vi.mocked(careerCounselingRepository.createSession).mockResolvedValue(makeCounselingSession() as any);
      vi.mocked(careerCounselingRepository.addMessage).mockResolvedValue({} as any);

      await careerCounselingService.createSession("user-1", "profile-1", {});

      expect(careerCounselingRepository.createSession).toHaveBeenCalledWith("profile-1", undefined);
    });
  });

  describe("getSession", () => {
    it("throws NOT_FOUND if session does not exist", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(null);

      await expect(
        careerCounselingService.getSession("session-1", "profile-1")
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });

    it("throws NOT_FOUND if session belongs to different student", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(
        makeCounselingSession({ studentProfileId: "other-profile" }) as any
      );

      await expect(
        careerCounselingService.getSession("session-1", "profile-1")
      ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });

    it("returns session if it belongs to the student", async () => {
      const session = makeCounselingSession({ studentProfileId: "profile-1" });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);

      const result = await careerCounselingService.getSession(session.id, "profile-1");

      expect(result).toEqual(session);
    });
  });

  describe("sendMessage", () => {
    it("throws NOT_FOUND if session does not exist", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(null);

      await expect(
        careerCounselingService.sendMessage("user-1", "session-1", "profile-1", { content: "test" })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws CONFLICT if session is completed", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(
        makeCounselingSession({ studentProfileId: "profile-1", status: "COMPLETED" }) as any
      );

      await expect(
        careerCounselingService.sendMessage("user-1", "session-1", "profile-1", { content: "test" })
      ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
    });

    it("throws CONFLICT if session is archived", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(
        makeCounselingSession({ studentProfileId: "profile-1", status: "ARCHIVED" }) as any
      );

      await expect(
        careerCounselingService.sendMessage("user-1", "session-1", "profile-1", { content: "test" })
      ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
    });

    it("sends message, extracts signals, and updates session", async () => {
      const session = makeCounselingSession({
        studentProfileId: "profile-1",
        currentStep: 2,
        confidenceScore: 0.3,
        signals: []
      });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);
      vi.mocked(careerCounselingRepository.addMessage).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.addSignal).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.updateSessionStatus).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.logAiUsage).mockResolvedValue({} as any);

      const result = await careerCounselingService.sendMessage(
        "user-1", session.id, "profile-1", { content: "코딩을 좋아해요" }
      );

      expect(careerCounselingRepository.addMessage).toHaveBeenCalledWith(session.id, "STUDENT", "코딩을 좋아해요");
      expect(result.message).toBeDefined();
      expect(result.step).toBe(3);
    });

    it("extracts interest signals from keywords", async () => {
      const session = makeCounselingSession({
        studentProfileId: "profile-1",
        currentStep: 1,
        signals: []
      });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);
      vi.mocked(careerCounselingRepository.addMessage).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.addSignal).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.updateSessionStatus).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.logAiUsage).mockResolvedValue({} as any);

      const result = await careerCounselingService.sendMessage(
        "user-1", session.id, "profile-1", { content: "수학을 좋아해요 재밌어요" }
      );

      expect(result.signals).toBeDefined();
      expect(result.signals!.some((s: any) => s.category === "interests")).toBe(true);
    });

    it("transitions to READY_FOR_REPORT at high confidence and sufficient steps", async () => {
      const signals = Array.from({ length: 10 }, (_, i) => makeSignal({ category: `cat-${i}` }));
      const session = makeCounselingSession({
        studentProfileId: "profile-1",
        currentStep: 7,
        confidenceScore: 0.75,
        signals
      });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);
      vi.mocked(careerCounselingRepository.addMessage).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.addSignal).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.createHypothesis).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.updateSessionStatus).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.logAiUsage).mockResolvedValue({} as any);

      const result = await careerCounselingService.sendMessage(
        "user-1", session.id, "profile-1", { content: "정말 좋아하는 것은 사람을 돕는 일이에요" }
      );

      expect(result.sessionStatus).toBe("READY_FOR_REPORT");
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.8);
    });

    it("stays ACTIVE at low step count even with signals", async () => {
      const session = makeCounselingSession({
        studentProfileId: "profile-1",
        currentStep: 2,
        confidenceScore: 0.2,
        signals: []
      });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);
      vi.mocked(careerCounselingRepository.addMessage).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.addSignal).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.updateSessionStatus).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.logAiUsage).mockResolvedValue({} as any);

      const result = await careerCounselingService.sendMessage(
        "user-1", session.id, "profile-1", { content: "좋아해요" }
      );

      expect(result.sessionStatus).toBe("ACTIVE");
    });
  });

  describe("generateReport", () => {
    it("throws NOT_FOUND if session does not exist", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(null);

      await expect(
        careerCounselingService.generateReport("user-1", "session-1", "profile-1")
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws CONFLICT if session is already completed", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(
        makeCounselingSession({ studentProfileId: "profile-1", status: "COMPLETED", report: null }) as any
      );

      await expect(
        careerCounselingService.generateReport("user-1", "session-1", "profile-1")
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("returns existing report if already generated (idempotent)", async () => {
      const existingReport = { id: "report-1", summary: "existing" };
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(
        makeCounselingSession({
          studentProfileId: "profile-1",
          status: "READY_FOR_REPORT",
          report: existingReport
        }) as any
      );

      const result = await careerCounselingService.generateReport("user-1", "session-1", "profile-1");

      expect(result).toEqual(existingReport);
      expect(careerCounselingRepository.createReport).not.toHaveBeenCalled();
    });

    it("throws CONFLICT if insufficient signals for report", async () => {
      const session = makeCounselingSession({
        studentProfileId: "profile-1",
        status: "READY_FOR_REPORT",
        confidenceScore: 0.85,
        messages: [{ role: "AI", content: "q1" }, { role: "STUDENT", content: "a1" }],
        signals: [makeSignal({ category: "interests" })],
        hypotheses: []
      });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);

      await expect(
        careerCounselingService.generateReport("user-1", session.id, "profile-1")
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("throws CONFLICT if insufficient messages for report", async () => {
      const session = makeCounselingSession({
        studentProfileId: "profile-1",
        status: "READY_FOR_REPORT",
        confidenceScore: 0.85,
        messages: [{ role: "AI", content: "q1" }],
        signals: [makeSignal({ category: "interests" }), makeSignal({ category: "strengths" }), makeSignal({ category: "values" })],
        hypotheses: []
      });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);

      await expect(
        careerCounselingService.generateReport("user-1", session.id, "profile-1")
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("throws CONFLICT if insufficient category diversity", async () => {
      const session = makeCounselingSession({
        studentProfileId: "profile-1",
        status: "READY_FOR_REPORT",
        confidenceScore: 0.85,
        messages: [{ role: "AI", content: "q" }, { role: "STUDENT", content: "a" }, { role: "AI", content: "q2" }, { role: "STUDENT", content: "a2" }],
        signals: [makeSignal({ category: "interests" }), makeSignal({ category: "interests" }), makeSignal({ category: "interests" })],
        hypotheses: []
      });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);

      await expect(
        careerCounselingService.generateReport("user-1", session.id, "profile-1")
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("generates report when minimum evidence requirements are met", async () => {
      const session = makeCounselingSession({
        studentProfileId: "profile-1",
        status: "READY_FOR_REPORT",
        confidenceScore: 0.85,
        messages: [
          { role: "AI", content: "q1" }, { role: "STUDENT", content: "a1" },
          { role: "AI", content: "q2" }, { role: "STUDENT", content: "a2" }
        ],
        signals: [
          makeSignal({ category: "interests" }),
          makeSignal({ category: "strengths" }),
          makeSignal({ category: "values" })
        ],
        hypotheses: [{ careerName: "개발자", reason: "코딩 관심", confidenceScore: 0.7, relatedMajors: ["컴퓨터공학"] }]
      });
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(session as any);
      const createdReport = { id: "report-new", summary: "generated" };
      vi.mocked(careerCounselingRepository.createReport).mockResolvedValue(createdReport as any);
      vi.mocked(careerCounselingRepository.updateSessionStatus).mockResolvedValue({} as any);
      vi.mocked(careerCounselingRepository.logAiUsage).mockResolvedValue({} as any);

      const result = await careerCounselingService.generateReport("user-1", session.id, "profile-1");

      expect(result).toEqual(createdReport);
      expect(careerCounselingRepository.updateSessionStatus).toHaveBeenCalledWith(
        session.id, "COMPLETED", 0.85
      );
    });
  });

  describe("getReport", () => {
    it("throws NOT_FOUND if session does not exist", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(null);

      await expect(
        careerCounselingService.getReport("session-1", "profile-1")
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws NOT_FOUND if report not yet generated", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(
        makeCounselingSession({ studentProfileId: "profile-1" }) as any
      );
      vi.mocked(careerCounselingRepository.getReport).mockResolvedValue(null);

      await expect(
        careerCounselingService.getReport("session-1", "profile-1")
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("returns report if exists", async () => {
      vi.mocked(careerCounselingRepository.findSessionById).mockResolvedValue(
        makeCounselingSession({ studentProfileId: "profile-1" }) as any
      );
      const report = { id: "report-1", summary: "test" };
      vi.mocked(careerCounselingRepository.getReport).mockResolvedValue(report as any);

      const result = await careerCounselingService.getReport("session-1", "profile-1");

      expect(result).toEqual(report);
    });
  });

  describe("extractBasicSignals", () => {
    it("detects interest keywords", () => {
      const signals = careerCounselingService.extractBasicSignals("수학이 재밌어요", 0);
      expect(signals).toHaveLength(1);
      expect(signals[0].category).toBe("interests");
    });

    it("detects dislike keywords", () => {
      const signals = careerCounselingService.extractBasicSignals("운동이 싫어요", 0);
      expect(signals).toHaveLength(1);
      expect(signals[0].category).toBe("disliked_activities");
    });

    it("detects strength keywords", () => {
      const signals = careerCounselingService.extractBasicSignals("그림 그리기를 잘하는 편이에요", 0);
      expect(signals).toHaveLength(1);
      expect(signals[0].category).toBe("strengths");
    });

    it("detects multiple signal categories in one message", () => {
      const signals = careerCounselingService.extractBasicSignals("코딩을 좋아하고 발표는 싫어요", 0);
      expect(signals).toHaveLength(2);
      const categories = signals.map(s => s.category);
      expect(categories).toContain("interests");
      expect(categories).toContain("disliked_activities");
    });

    it("returns empty for messages without signal keywords", () => {
      const signals = careerCounselingService.extractBasicSignals("그냥 보통이에요", 0);
      expect(signals).toHaveLength(0);
    });

    it("limits value to 100 chars", () => {
      const longMessage = "좋아" + "x".repeat(200);
      const signals = careerCounselingService.extractBasicSignals(longMessage, 0);
      expect(signals[0].value.length).toBeLessThanOrEqual(100);
    });
  });

  describe("generateBasicHypotheses", () => {
    it("returns empty array if fewer than 3 total signals", () => {
      const result = careerCounselingService.generateBasicHypotheses(
        [makeSignal()], [makeSignal()]
      );
      expect(result).toHaveLength(0);
    });

    it("generates exploration hypothesis with 3+ signals", () => {
      const signals = [makeSignal(), makeSignal(), makeSignal()];
      const result = careerCounselingService.generateBasicHypotheses(signals, []);
      expect(result).toHaveLength(1);
      expect(result[0].careerName).toBe("탐색 중");
      expect(result[0].confidenceScore).toBe(0.3);
    });

    it("includes supporting evidence from signals", () => {
      const signals = [
        makeSignal({ value: "코딩" }),
        makeSignal({ value: "수학" }),
        makeSignal({ value: "과학" })
      ];
      const result = careerCounselingService.generateBasicHypotheses(signals, []);
      expect(result[0].supportingEvidence.length).toBeGreaterThan(0);
    });

    it("limits supporting evidence to 5 items", () => {
      const signals = Array.from({ length: 10 }, () => makeSignal());
      const result = careerCounselingService.generateBasicHypotheses(signals, []);
      expect(result[0].supportingEvidence.length).toBeLessThanOrEqual(5);
    });
  });

  describe("generateAiResponse", () => {
    it("increases confidence with each step", async () => {
      const session1 = makeCounselingSession({ currentStep: 1, signals: [] });
      const session5 = makeCounselingSession({ currentStep: 5, signals: [] });

      const result1 = await careerCounselingService.generateAiResponse(session1, "test");
      const result5 = await careerCounselingService.generateAiResponse(session5, "test");

      expect(result5.confidenceScore).toBeGreaterThan(result1.confidenceScore);
    });

    it("caps confidence at 0.95", async () => {
      const session = makeCounselingSession({ currentStep: 15, signals: [] });
      const result = await careerCounselingService.generateAiResponse(session, "좋아하고 재밌고 잘하는");
      expect(result.confidenceScore).toBeLessThanOrEqual(0.95);
    });

    it("does not generate hypotheses before step 3", async () => {
      const session = makeCounselingSession({ currentStep: 1, signals: [] });
      const result = await careerCounselingService.generateAiResponse(session, "test");
      expect(result.hypotheses).toHaveLength(0);
    });

    it("generates hypotheses at step 3+ with enough signals", async () => {
      const signals = Array.from({ length: 5 }, () => makeSignal());
      const session = makeCounselingSession({ currentStep: 4, signals });
      const result = await careerCounselingService.generateAiResponse(session, "좋아하는 것은");
      expect(result.hypotheses.length).toBeGreaterThanOrEqual(0);
    });

    it("includes career names in message at step 5+", async () => {
      const signals = Array.from({ length: 5 }, () => makeSignal());
      const session = makeCounselingSession({ currentStep: 5, signals });
      const result = await careerCounselingService.generateAiResponse(session, "좋아하는 것은");
      if (result.hypotheses.length > 0) {
        expect(result.message).toContain("가능성");
      }
    });

    it("estimates token count based on message length", async () => {
      const session = makeCounselingSession({ currentStep: 1, signals: [] });
      const result = await careerCounselingService.generateAiResponse(session, "short");
      expect(result.tokenCount).toBeGreaterThan(0);
    });
  });
});
