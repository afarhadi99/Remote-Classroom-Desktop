-- Shareable, revocable read-only parent/guardian view link per student.
CREATE TABLE "ParentLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ParentLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ParentLink_token_key" ON "ParentLink"("token");
CREATE INDEX "ParentLink_studentId_idx" ON "ParentLink"("studentId");
ALTER TABLE "ParentLink" ADD CONSTRAINT "ParentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
