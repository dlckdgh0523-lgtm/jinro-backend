-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "rag";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "RefreshTokenStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TrackType" AS ENUM ('STEM', 'HUMANITIES', 'ARTS', 'UNDECIDED');

-- CreateEnum
CREATE TYPE "SemesterTerm" AS ENUM ('FIRST', 'SECOND', 'SUMMER', 'WINTER');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('MIDTERM', 'FINAL');

-- CreateEnum
CREATE TYPE "StudyPlanSource" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "StudyTaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DANGER', 'WARNING', 'INFO', 'SUCCESS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CounselingRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CounselingRequestType" AS ENUM ('ACADEMIC', 'CAREER', 'EMOTIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CounselingMemoVisibility" AS ENUM ('TEACHER_ONLY', 'STUDENT_SHARED');

-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('EARLY', 'REGULAR');

-- CreateEnum
CREATE TYPE "AdmissionCategory" AS ENUM ('STUDENT_RECORD_CURRICULUM', 'STUDENT_RECORD_COMPREHENSIVE', 'ESSAY', 'CSAT', 'PERFORMANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "rag"."RagSourceType" AS ENUM ('PDF', 'HTML', 'CSV', 'XLSX', 'MANUAL');

-- CreateEnum
CREATE TYPE "rag"."RagDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "rag"."RagChunkStatus" AS ENUM ('READY', 'EMBEDDED', 'FAILED');

-- CreateEnum
CREATE TYPE "rag"."RagIngestionStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AiConversationType" AS ENUM ('COUNSELING', 'CAREER', 'INTERNAL_SUMMARY', 'GROWTH_REPORT', 'RAG_QUERY');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "AiMessageStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiRoute" AS ENUM ('LLM', 'RAG', 'HYBRID');

-- CreateEnum
CREATE TYPE "audit"."AuditActorType" AS ENUM ('USER', 'SYSTEM', 'JOB');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "passwordHash" TEXT,
    "deletedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "classLabel" TEXT,
    "track" "TrackType" NOT NULL DEFAULT 'UNDECIDED',
    "academicNotes" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "hasNaesin" BOOLEAN,
    "hasSuneung" BOOLEAN,
    "selectedSuneungSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetCsatScore" INTEGER,
    "currentAverageGrade" DOUBLE PRECISION,
    "classroomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "subjectAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassRoom" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "classNumber" INTEGER NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homeroomTeacherId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherStudentAssignment" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL DEFAULT 'HOMEROOM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherStudentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "RefreshTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "userAgentHash" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeExamRecord" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "semesterTerm" "SemesterTerm" NOT NULL,
    "semesterLabel" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "subjectName" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "statusLabel" TEXT,
    "memo" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeExamRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemesterFinalGrade" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "semesterTerm" "SemesterTerm" NOT NULL,
    "semesterLabel" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "finalGrade" DOUBLE PRECISION NOT NULL,
    "credit" INTEGER NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemesterFinalGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamResult" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "examMonth" INTEGER NOT NULL,
    "examLabel" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "grade" DOUBLE PRECISION,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "source" "StudyPlanSource" NOT NULL DEFAULT 'MANUAL',
    "completionRate" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyTask" (
    "id" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "dayOrder" INTEGER NOT NULL,
    "priority" "StudyTaskPriority" NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounselingRequest" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "type" "CounselingRequestType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CounselingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounselingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounselingMemo" (
    "id" TEXT NOT NULL,
    "counselingRequestId" TEXT,
    "studentProfileId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "visibility" "CounselingMemoVisibility" NOT NULL DEFAULT 'TEACHER_ONLY',
    "sharedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounselingMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalSetting" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "fieldGroup" TEXT NOT NULL,
    "universityId" TEXT,
    "universityNameSnapshot" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentNameSnapshot" TEXT NOT NULL,
    "targetGrade" DOUBLE PRECISION,
    "targetScore" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldGroup" TEXT NOT NULL,
    "universityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionRecord" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "departmentId" TEXT,
    "year" INTEGER NOT NULL,
    "admissionType" "AdmissionType" NOT NULL,
    "category" "AdmissionCategory" NOT NULL,
    "cutGradeText" TEXT NOT NULL,
    "cutGradeNumeric" DOUBLE PRECISION,
    "seats" INTEGER NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentProfileId" TEXT,
    "teacherProfileId" TEXT,
    "type" "AiConversationType" NOT NULL,
    "route" "AiRoute",
    "title" TEXT,
    "latestSummary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "aiConversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "status" "AiMessageStatus" NOT NULL DEFAULT 'COMPLETED',
    "content" TEXT NOT NULL,
    "promptTemplateKey" TEXT,
    "modelName" TEXT,
    "citations" JSONB,
    "tokenUsage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag"."RagSource" (
    "id" TEXT NOT NULL,
    "sourceType" "rag"."RagSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "checksum" TEXT,
    "versionLabel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag"."RagDocument" (
    "id" TEXT NOT NULL,
    "ragSourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "externalRef" TEXT,
    "status" "rag"."RagDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "year" INTEGER,
    "admissionType" TEXT,
    "region" TEXT,
    "citationLabel" TEXT,
    "rawText" TEXT,
    "normalizedJson" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag"."RagChunk" (
    "id" TEXT NOT NULL,
    "ragDocumentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "citationLocator" TEXT,
    "metadata" JSONB,
    "embedding" JSONB,
    "embeddingModel" TEXT,
    "status" "rag"."RagChunkStatus" NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag"."RagIngestionJob" (
    "id" TEXT NOT NULL,
    "ragSourceId" TEXT,
    "initiatedByUserId" TEXT,
    "status" "rag"."RagIngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metrics" JSONB,

    CONSTRAINT "RagIngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "audit"."AuditActorType" NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requestId" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_schoolName_gradeLevel_classLabel_idx" ON "StudentProfile"("schoolName", "gradeLevel", "classLabel");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE INDEX "TeacherProfile_schoolName_idx" ON "TeacherProfile"("schoolName");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoom_inviteCode_key" ON "ClassRoom"("inviteCode");

-- CreateIndex
CREATE INDEX "ClassRoom_homeroomTeacherId_idx" ON "ClassRoom"("homeroomTeacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoom_schoolName_academicYear_gradeLevel_classNumber_key" ON "ClassRoom"("schoolName", "academicYear", "gradeLevel", "classNumber");

-- CreateIndex
CREATE INDEX "TeacherStudentAssignment_studentProfileId_active_idx" ON "TeacherStudentAssignment"("studentProfileId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherStudentAssignment_teacherProfileId_studentProfileId__key" ON "TeacherStudentAssignment"("teacherProfileId", "studentProfileId", "classroomId", "assignmentType");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_status_idx" ON "RefreshToken"("userId", "status");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "GradeExamRecord_studentProfileId_savedAt_idx" ON "GradeExamRecord"("studentProfileId", "savedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GradeExamRecord_studentProfileId_academicYear_semesterTerm__key" ON "GradeExamRecord"("studentProfileId", "academicYear", "semesterTerm", "examType", "subjectName");

-- CreateIndex
CREATE INDEX "SemesterFinalGrade_studentProfileId_savedAt_idx" ON "SemesterFinalGrade"("studentProfileId", "savedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SemesterFinalGrade_studentProfileId_academicYear_semesterTe_key" ON "SemesterFinalGrade"("studentProfileId", "academicYear", "semesterTerm", "subjectName");

-- CreateIndex
CREATE INDEX "MockExamResult_studentProfileId_savedAt_idx" ON "MockExamResult"("studentProfileId", "savedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MockExamResult_studentProfileId_academicYear_examMonth_subj_key" ON "MockExamResult"("studentProfileId", "academicYear", "examMonth", "subjectName");

-- CreateIndex
CREATE INDEX "StudyPlan_studentProfileId_weekStartDate_idx" ON "StudyPlan"("studentProfileId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_studentProfileId_weekStartDate_key" ON "StudyPlan"("studentProfileId", "weekStartDate");

-- CreateIndex
CREATE INDEX "StudyTask_studyPlanId_dayOrder_orderIndex_idx" ON "StudyTask"("studyPlanId", "dayOrder", "orderIndex");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_dedupeKey_idx" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "CounselingRequest_teacherProfileId_status_requestedAt_idx" ON "CounselingRequest"("teacherProfileId", "status", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "CounselingRequest_studentProfileId_requestedAt_idx" ON "CounselingRequest"("studentProfileId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "CounselingMemo_studentProfileId_createdAt_idx" ON "CounselingMemo"("studentProfileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CounselingMemo_teacherProfileId_createdAt_idx" ON "CounselingMemo"("teacherProfileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GoalSetting_studentProfileId_isActive_updatedAt_idx" ON "GoalSetting"("studentProfileId", "isActive", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "University_name_key" ON "University"("name");

-- CreateIndex
CREATE INDEX "University_name_idx" ON "University"("name");

-- CreateIndex
CREATE INDEX "Department_fieldGroup_name_idx" ON "Department"("fieldGroup", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_fieldGroup_universityId_key" ON "Department"("name", "fieldGroup", "universityId");

-- CreateIndex
CREATE INDEX "AdmissionRecord_year_admissionType_category_idx" ON "AdmissionRecord"("year", "admissionType", "category");

-- CreateIndex
CREATE INDEX "AdmissionRecord_universityId_departmentId_idx" ON "AdmissionRecord"("universityId", "departmentId");

-- CreateIndex
CREATE INDEX "AiConversation_userId_type_updatedAt_idx" ON "AiConversation"("userId", "type", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "AiMessage_aiConversationId_createdAt_idx" ON "AiMessage"("aiConversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RagSource_checksum_key" ON "rag"."RagSource"("checksum");

-- CreateIndex
CREATE INDEX "RagSource_sourceType_name_idx" ON "rag"."RagSource"("sourceType", "name");

-- CreateIndex
CREATE INDEX "RagDocument_status_year_admissionType_idx" ON "rag"."RagDocument"("status", "year", "admissionType");

-- CreateIndex
CREATE INDEX "RagChunk_status_embeddingModel_idx" ON "rag"."RagChunk"("status", "embeddingModel");

-- CreateIndex
CREATE UNIQUE INDEX "RagChunk_ragDocumentId_chunkIndex_key" ON "rag"."RagChunk"("ragDocumentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "RagIngestionJob_status_requestedAt_idx" ON "rag"."RagIngestionJob"("status", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_createdAt_idx" ON "audit"."AuditLog"("resourceType", "resourceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "audit"."AuditLog"("actorUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoom" ADD CONSTRAINT "ClassRoom_homeroomTeacherId_fkey" FOREIGN KEY ("homeroomTeacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherStudentAssignment" ADD CONSTRAINT "TeacherStudentAssignment_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherStudentAssignment" ADD CONSTRAINT "TeacherStudentAssignment_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherStudentAssignment" ADD CONSTRAINT "TeacherStudentAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "ClassRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeExamRecord" ADD CONSTRAINT "GradeExamRecord_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterFinalGrade" ADD CONSTRAINT "SemesterFinalGrade_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamResult" ADD CONSTRAINT "MockExamResult_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselingRequest" ADD CONSTRAINT "CounselingRequest_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselingRequest" ADD CONSTRAINT "CounselingRequest_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselingMemo" ADD CONSTRAINT "CounselingMemo_counselingRequestId_fkey" FOREIGN KEY ("counselingRequestId") REFERENCES "CounselingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselingMemo" ADD CONSTRAINT "CounselingMemo_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselingMemo" ADD CONSTRAINT "CounselingMemo_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalSetting" ADD CONSTRAINT "GoalSetting_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalSetting" ADD CONSTRAINT "GoalSetting_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalSetting" ADD CONSTRAINT "GoalSetting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag"."RagDocument" ADD CONSTRAINT "RagDocument_ragSourceId_fkey" FOREIGN KEY ("ragSourceId") REFERENCES "rag"."RagSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag"."RagChunk" ADD CONSTRAINT "RagChunk_ragDocumentId_fkey" FOREIGN KEY ("ragDocumentId") REFERENCES "rag"."RagDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag"."RagIngestionJob" ADD CONSTRAINT "RagIngestionJob_ragSourceId_fkey" FOREIGN KEY ("ragSourceId") REFERENCES "rag"."RagSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag"."RagIngestionJob" ADD CONSTRAINT "RagIngestionJob_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
