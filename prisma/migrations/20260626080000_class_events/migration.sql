-- Append-only class activity / audit log
CREATE TABLE "ClassEvent" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassEvent_classroomId_createdAt_idx" ON "ClassEvent"("classroomId", "createdAt");

ALTER TABLE "ClassEvent" ADD CONSTRAINT "ClassEvent_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassEvent" ADD CONSTRAINT "ClassEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
