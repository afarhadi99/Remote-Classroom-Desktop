-- LTI Advantage: service-auth token cache, NRPS/AGS endpoints, grade-passback jobs.
ALTER TABLE "Classroom" ADD COLUMN "ltiNrpsUrl" TEXT;
ALTER TABLE "Classroom" ADD COLUMN "ltiAgsLineitemsUrl" TEXT;
ALTER TABLE "Student" ADD COLUMN "ltiUserId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN "ltiLineItemUrl" TEXT;

CREATE TABLE "LtiServiceToken" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LtiServiceToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LtiServiceToken_platformId_scopeKey_key" ON "LtiServiceToken"("platformId", "scopeKey");

CREATE TABLE "LtiGradeJob" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scoreGiven" INTEGER NOT NULL,
    "scoreMaximum" INTEGER NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LtiGradeJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LtiGradeJob_status_nextAttemptAt_idx" ON "LtiGradeJob"("status", "nextAttemptAt");
