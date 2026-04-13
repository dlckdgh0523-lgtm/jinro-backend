import type { Router } from "express";
import { z } from "zod";
import { prisma } from "../infra/prisma";
import { authenticate, type AuthenticatedRequest } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { env } from "../config/env";
import { resolveStudentProfileId } from "../common/domain";

type Citation = {
  documentId: string;
  title: string;
  locator?: string | null;
  sourceName: string;
  excerpt: string;
};

interface LlmProvider {
  generate(input: { systemPrompt: string; message: string; citations?: Citation[] }): Promise<{ text: string; model: string }>;
}

interface RagRetriever {
  search(query: string): Promise<Citation[]>;
}

class StubLlmProvider implements LlmProvider {
  public async generate(input: { systemPrompt: string; message: string; citations?: Citation[] }) {
    const citationHint =
      input.citations && input.citations.length > 0
        ? `\n\n참고 근거 ${input.citations.length}건을 반영한 초안 응답입니다.`
        : "";

    return {
      text: `${input.systemPrompt}\n\n질문: ${input.message}\n\n현재는 provider stub이므로 운영용 모델 연결 전 임시 응답만 반환합니다.${citationHint}`,
      model: env.AI_MODEL_DEFAULT
    };
  }
}

/**
 * ⚠️ OpenAI LLM Provider
 * 
 * 환경변수:
 * - OPENAI_API_KEY: OpenAI API 키 (필수, .env에 설정 필요)
 * - AI_MODEL_DEFAULT: 사용할 모델명 (기본값: gpt-4o-mini, 환경변수로 override 가능)
 * - OPENAI_BASE_URL: API 엔드포인트 (기본값: https://api.openai.com/v1)
 * 
 * 사용 모델:
 * - gpt-4o-mini (권장, 저비용)
 * - gpt-4-turbo (고품질)
 * - o1-mini (추론 최적화)
 * 
 * 참고: 실제 호출을 위해서는 OPENAI_API_KEY를 .env에 설정해야 합니다.
 */
class OpenAiLlmProvider implements LlmProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = env.OPENAI_API_KEY || env.AI_API_KEY || "";
    this.model = env.AI_MODEL_DEFAULT || "gpt-4o-mini";
    this.baseUrl = env.OPENAI_BASE_URL || "https://api.openai.com/v1";

    if (!this.apiKey) {
      throw new Error(
        "OpenAI API key not configured. " +
        "Set OPENAI_API_KEY or AI_API_KEY environment variable to use OpenAI provider."
      );
    }
  }

  public async generate(input: { systemPrompt: string; message: string; citations?: Citation[] }) {
    try {
      // OpenAI API 호출
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: input.systemPrompt
            },
            {
              role: "user",
              content: input.message
            }
          ],
          temperature: 0.7,
          max_tokens: 1024,
          timeout: env.AI_REQUEST_TIMEOUT_MS
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const responseText = data.choices?.[0]?.message?.content || "응답을 생성할 수 없습니다.";

      return {
        text: responseText,
        model: this.model
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`OpenAI provider failed: ${errorMsg}`);
    }
  }
}

/**
 * ⚠️ OpenAI LLM Provider
 * 
 * 환경변수:
 * - OPENAI_API_KEY: OpenAI API 키 (필수)
 * - AI_MODEL_DEFAULT: 사용할 모델명 (기본값: gpt-4o-mini)
 * - OPENAI_BASE_URL: API 엔드포인트 (기본값: https://api.openai.com/v1)
 * - AI_REQUEST_TIMEOUT_MS: 타임아웃 시간 (기본값: 30000)
 * 
 * 다음 턴에서 실제 구현:
 * 1. openai 패키지 설치 (npm install openai)
 * 2. OPENAI_API_KEY 주입
 * 3. 실제 호출 로직 추가
 */
class OpenAiLlmProvider implements LlmProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeout: number;

  constructor(apiKey: string, model: string, baseUrl: string, timeout: number) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  public async generate(input: { systemPrompt: string; message: string; citations?: Citation[] }) {
    // ⚠️ 이 부분은 다음 턴에서 실제 OpenAI 호출로 교체됨
    // 현재는 stub처럼 동작하되, 구조만 OpenAI 형식으로 준비
    
    const citationHint =
      input.citations && input.citations.length > 0
        ? `\n\n참고 근거 ${input.citations.length}건을 반영한 응답입니다.`
        : "";

    // 실제 구현 시 여기서:
    // const response = await fetch(`${this.baseUrl}/chat/completions`, {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${this.apiKey}`,
    //     "Content-Type": "application/json"
    //   },
    //   body: JSON.stringify({
    //     model: this.model,
    //     messages: [
    //       { role: "system", content: input.systemPrompt },
    //       { role: "user", content: input.message }
    //     ],
    //     temperature: 0.7,
    //     max_tokens: 1000,
    //     timeout: this.timeout
    //   })
    // });

    return {
      text: `${input.systemPrompt}\n\n질문: ${input.message}\n\n[OpenAI 모델: ${this.model}]${citationHint}`,
      model: this.model
    };
  }
}

class StubRagRetriever implements RagRetriever {
  public async search(query: string) {
    const chunks = await prisma.ragChunk.findMany({
      where: {
        status: "READY",
        content: {
          contains: query,
          mode: "insensitive"
        }
      },
      take: 5,
      include: {
        ragDocument: {
          include: {
            ragSource: true
          }
        }
      }
    });

    const fallbackChunks =
      chunks.length > 0
        ? chunks
        : await prisma.ragChunk.findMany({
            where: {
              status: "READY"
            },
            take: 3,
            include: {
              ragDocument: {
                include: {
                  ragSource: true
                }
              }
            }
          });

    return fallbackChunks.map((chunk) => ({
      documentId: chunk.ragDocumentId,
      title: chunk.ragDocument.title,
      locator: chunk.citationLocator,
      sourceName: chunk.ragDocument.ragSource.name,
      excerpt: chunk.content.slice(0, 180)
    }));
  }
}

const llmProvider = (() => {
  if (env.AI_PROVIDER === "openai") {
    const apiKey = env.OPENAI_API_KEY || env.AI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️  AI_PROVIDER=openai 이지만 OPENAI_API_KEY가 없습니다. Stub 모드로 폴백합니다."
      );
      return new StubLlmProvider();
    }
    return new OpenAiLlmProvider(
      apiKey,
      env.AI_MODEL_DEFAULT,
      env.OPENAI_BASE_URL,
      env.AI_REQUEST_TIMEOUT_MS
    );
  }
  // 기본값: stub
  return new StubLlmProvider();
})();

const ragRetriever = new StubRagRetriever();

const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  message: z.string().min(1)
});

const persistConversationTurn = async (input: {
  userId: string;
  conversationId?: string;
  studentProfileId?: string;
  type: "COUNSELING" | "CAREER" | "RAG_QUERY";
  route: "LLM" | "RAG" | "HYBRID";
  userMessage: string;
  assistantMessage: string;
  citations: Citation[];
}) => {
  let targetConversation = input.conversationId
    ? await prisma.aiConversation.findUnique({
        where: { id: input.conversationId }
      })
    : null;

  if (!targetConversation) {
    targetConversation = await prisma.aiConversation.create({
      data: {
        userId: input.userId,
        studentProfileId: input.studentProfileId,
        type: input.type,
        route: input.route,
        title: input.userMessage.slice(0, 60)
      }
    });
  }

  await prisma.aiMessage.createMany({
    data: [
      {
        aiConversationId: targetConversation.id,
        role: "USER",
        status: "COMPLETED",
        content: input.userMessage
      },
      {
        aiConversationId: targetConversation.id,
        role: "ASSISTANT",
        status: "COMPLETED",
        content: input.assistantMessage,
        modelName: env.AI_MODEL_DEFAULT,
        citations: input.citations
      }
    ]
  });

  await prisma.aiConversation.update({
    where: { id: targetConversation.id },
    data: {
      route: input.route,
      latestSummary: input.assistantMessage.slice(0, 240)
    }
  });

  return targetConversation.id;
};

const detectRoute = (message: string): "LLM" | "RAG" | "HYBRID" => {
  const lower = message.toLowerCase();
  const hasRagSignal =
    /대학|학과|전형|등급컷|입시|원서|합격|모집인원/.test(message) ||
    lower.includes("admission");
  const hasCounselingSignal =
    /상담|학습|진로|불안|추천|계획|성장/.test(message) ||
    lower.includes("career");

  if (hasRagSignal && hasCounselingSignal) return "HYBRID";
  if (hasRagSignal) return "RAG";
  return "LLM";
};

export const registerAiRoutes = (router: Router) => {
  router.post(
    "/ai/chat",
    authenticate,
    validate(chatSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const studentProfileId =
        req.auth!.role === "STUDENT"
          ? await resolveStudentProfileId(prisma, req.auth!)
          : req.body.studentId
            ? await resolveStudentProfileId(prisma, req.auth!, req.body.studentId)
            : undefined;

      const route = detectRoute(req.body.message);
      const citations = route === "LLM" ? [] : await ragRetriever.search(req.body.message);
      const response = await llmProvider.generate({
        systemPrompt:
          route === "HYBRID"
            ? "상담 맥락과 입시 근거를 함께 반영하는 오케스트레이터 응답입니다."
            : route === "RAG"
              ? "입시 근거 기반 응답입니다."
              : "상담/학습 지원 응답입니다.",
        message: req.body.message,
        citations
      });

      const conversationId = await persistConversationTurn({
        userId: req.auth!.sub,
        conversationId: req.body.conversationId,
        studentProfileId,
        type: route === "RAG" ? "RAG_QUERY" : "COUNSELING",
        route,
        userMessage: req.body.message,
        assistantMessage: response.text,
        citations
      });

      sendSuccess(req, res, {
        conversationId,
        route,
        answer: response.text,
        citations,
        meta: {
          provider: env.AI_PROVIDER,
          model: response.model,
          isStub: env.AI_PROVIDER === "stub" || !env.OPENAI_API_KEY
        }
      });
    })
  );

  router.post(
    "/ai/career-chat",
    authenticate,
    validate(chatSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const studentProfileId =
        req.auth!.role === "STUDENT"
          ? await resolveStudentProfileId(prisma, req.auth!)
          : req.body.studentId
            ? await resolveStudentProfileId(prisma, req.auth!, req.body.studentId)
            : undefined;

      const response = await llmProvider.generate({
        systemPrompt: "학생의 흥미/적성/성적을 기반으로 진로 대화를 진행하는 career-chat 응답입니다.",
        message: req.body.message
      });

      const conversationId = await persistConversationTurn({
        userId: req.auth!.sub,
        conversationId: req.body.conversationId,
        studentProfileId,
        type: "CAREER",
        route: "LLM",
        userMessage: req.body.message,
        assistantMessage: response.text,
        citations: []
      });

      sendSuccess(req, res, {
        conversationId,
        route: "LLM",
        answer: response.text,
        citations: [],
        meta: {
          provider: env.AI_PROVIDER,
          model: response.model,
          isStub: env.AI_PROVIDER === "stub" || !env.OPENAI_API_KEY
        }
      });
    })
  );

  router.post(
    "/rag/query",
    authenticate,
    validate(chatSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const citations = await ragRetriever.search(req.body.message);
      const response = await llmProvider.generate({
        systemPrompt: "입시정보 RAG 질의에 대해 인용 근거를 포함한 답변 초안을 생성합니다.",
        message: req.body.message,
        citations
      });

      sendSuccess(req, res, {
        route: "RAG",
        answer: response.text,
        citations,
        meta: {
          provider: env.AI_PROVIDER,
          model: response.model,
          isStub: env.AI_PROVIDER === "stub" || !env.OPENAI_API_KEY
        }
      });
    })
  );
};
