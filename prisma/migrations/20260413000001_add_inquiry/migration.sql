-- Create InquiryStatus enum
CREATE TYPE "public"."InquiryStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ANSWERED', 'CLOSED');

-- Create Inquiry table
CREATE TABLE "public"."Inquiry" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "subject"    TEXT NOT NULL,
    "content"    TEXT NOT NULL,
    "status"     "public"."InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "adminReply" TEXT,
    "repliedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- Foreign key to User
ALTER TABLE "public"."Inquiry"
    ADD CONSTRAINT "Inquiry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Inquiry_userId_createdAt_idx" ON "public"."Inquiry"("userId", "createdAt" DESC);
CREATE INDEX "Inquiry_status_createdAt_idx" ON "public"."Inquiry"("status", "createdAt" DESC);
