-- Group workstations: shared desktops + a shared volume for a set of students.
CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "volumeId" TEXT,
    "volumeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClassGroup_classroomId_idx" ON "ClassGroup"("classroomId");
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Student" ADD COLUMN "groupId" TEXT;
CREATE INDEX "Student_groupId_idx" ON "Student"("groupId");
ALTER TABLE "Student" ADD CONSTRAINT "Student_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Machine" ADD COLUMN "groupId" TEXT;
CREATE INDEX "Machine_groupId_idx" ON "Machine"("groupId");
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
