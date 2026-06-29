-- Assignments + submissions: closes the assign -> collect -> return loop; Submission.score
-- is the canonical grade record (read by LTI AGS passback).
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "collectFolder" TEXT NOT NULL DEFAULT 'Turn-in',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "score" INTEGER,
    "scoreMax" INTEGER,
    "feedback" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_key" ON "Submission"("assignmentId", "studentId");
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
