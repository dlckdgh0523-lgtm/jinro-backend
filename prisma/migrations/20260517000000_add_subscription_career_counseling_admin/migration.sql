-- Add SUPER_ADMIN role
ALTER TYPE "public"."UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Subscription & Payment enums
CREATE TYPE "public"."PlanType" AS ENUM ('STUDENT_PERSONAL', 'TEACHER_CLASSROOM');
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'PAYMENT_FAILED');
CREATE TYPE "public"."PaymentEventStatus" AS ENUM ('REQUESTED', 'APPROVED', 'FAILED', 'CANCELED', 'REFUNDED');

-- AI Career Counseling enums
CREATE TYPE "public"."CounselingSessionStatus" AS ENUM ('ACTIVE', 'READY_FOR_REPORT', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "public"."CounselingMessageRole" AS ENUM ('STUDENT', 'AI', 'SYSTEM_NOTE');

-- Subscription table
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planType" "public"."PlanType" NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "maxStudents" INTEGER NOT NULL DEFAULT 0,
    "priceKrw" INTEGER NOT NULL,
    "pgCustomerId" TEXT,
    "pgSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- SubscriptionEvent table
CREATE TABLE "public"."SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- Payment table
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "status" "public"."PaymentEventStatus" NOT NULL DEFAULT 'REQUESTED',
    "pgPaymentId" TEXT,
    "pgProvider" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CareerCounselingSession table
CREATE TABLE "public"."CareerCounselingSession" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "status" "public"."CounselingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "title" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CareerCounselingSession_pkey" PRIMARY KEY ("id")
);

-- CareerCounselingMessage table
CREATE TABLE "public"."CareerCounselingMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "public"."CounselingMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "extractedSignals" JSONB,
    "tokenUsage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareerCounselingMessage_pkey" PRIMARY KEY ("id")
);

-- CareerSignal table
CREATE TABLE "public"."CareerSignal" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "evidence" TEXT,
    "messageRef" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareerSignal_pkey" PRIMARY KEY ("id")
);

-- CareerHypothesis table
CREATE TABLE "public"."CareerHypothesis" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "careerName" TEXT NOT NULL,
    "relatedMajors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT NOT NULL,
    "supportingEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingInformation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CareerHypothesis_pkey" PRIMARY KEY ("id")
);

-- CareerReport table
CREATE TABLE "public"."CareerReport" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedCareers" JSONB NOT NULL,
    "recommendedMajors" JSONB NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "studyPlan" JSONB,
    "nextQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence" JSONB NOT NULL,
    "disclaimer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareerReport_pkey" PRIMARY KEY ("id")
);

-- AiUsageLog table
CREATE TABLE "public"."AiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "actionType" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "modelName" TEXT,
    "costKrw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- NotificationDeliveryLog table
CREATE TABLE "public"."NotificationDeliveryLog" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "Payment_pgPaymentId_key" ON "public"."Payment"("pgPaymentId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "public"."Payment"("idempotencyKey");
CREATE UNIQUE INDEX "CareerReport_sessionId_key" ON "public"."CareerReport"("sessionId");

-- Notification deduplication: unique userId + dedupeKey (replaces simple index)
DROP INDEX IF EXISTS "public"."Notification_userId_dedupeKey_idx";
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "public"."Notification"("userId", "dedupeKey");

-- Indexes
CREATE INDEX "Subscription_userId_status_idx" ON "public"."Subscription"("userId", "status");
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "public"."Subscription"("status", "currentPeriodEnd");
CREATE INDEX "SubscriptionEvent_subscriptionId_createdAt_idx" ON "public"."SubscriptionEvent"("subscriptionId", "createdAt" DESC);
CREATE INDEX "Payment_userId_createdAt_idx" ON "public"."Payment"("userId", "createdAt" DESC);
CREATE INDEX "Payment_subscriptionId_status_idx" ON "public"."Payment"("subscriptionId", "status");
CREATE INDEX "CareerCounselingSession_studentProfileId_status_updatedAt_idx" ON "public"."CareerCounselingSession"("studentProfileId", "status", "updatedAt" DESC);
CREATE INDEX "CareerCounselingMessage_sessionId_createdAt_idx" ON "public"."CareerCounselingMessage"("sessionId", "createdAt");
CREATE INDEX "CareerSignal_sessionId_category_idx" ON "public"."CareerSignal"("sessionId", "category");
CREATE INDEX "CareerHypothesis_sessionId_active_idx" ON "public"."CareerHypothesis"("sessionId", "active");
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "public"."AiUsageLog"("userId", "createdAt" DESC);
CREATE INDEX "AiUsageLog_actionType_createdAt_idx" ON "public"."AiUsageLog"("actionType", "createdAt" DESC);
CREATE INDEX "NotificationDeliveryLog_notificationId_idx" ON "public"."NotificationDeliveryLog"("notificationId");

-- Foreign keys
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CareerCounselingSession" ADD CONSTRAINT "CareerCounselingSession_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "public"."StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CareerCounselingMessage" ADD CONSTRAINT "CareerCounselingMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."CareerCounselingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CareerSignal" ADD CONSTRAINT "CareerSignal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."CareerCounselingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CareerHypothesis" ADD CONSTRAINT "CareerHypothesis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."CareerCounselingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CareerReport" ADD CONSTRAINT "CareerReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."CareerCounselingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."NotificationDeliveryLog" ADD CONSTRAINT "NotificationDeliveryLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "public"."Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
