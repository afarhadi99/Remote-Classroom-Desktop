-- Weekly auto-boot schedule slots
CREATE TABLE "ClassSchedule" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 45,
    "os" TEXT NOT NULL DEFAULT 'linux',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassSchedule_classroomId_idx" ON "ClassSchedule"("classroomId");

ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
