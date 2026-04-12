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

const llmProvider = new StubLlmProvider();
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
          isStub: true
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
          isStub: true
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
          isStub: true
        }
      });
    })
  );
};
