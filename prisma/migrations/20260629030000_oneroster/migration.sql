-- OneRoster / SIS roster sync: stable sourcedId identity + soft-delete (de-provisioning).
ALTER TABLE "Classroom" ADD COLUMN "sourcedId" TEXT;
ALTER TABLE "Student" ADD COLUMN "sourcedId" TEXT;
ALTER TABLE "Student" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Classroom_teacherId_sourcedId_idx" ON "Classroom"("teacherId", "sourcedId");
CREATE INDEX "Student_sourcedId_idx" ON "Student"("sourcedId");
