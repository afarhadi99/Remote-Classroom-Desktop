-- Shared class countdown timer, visible live to every student.
ALTER TABLE "Classroom" ADD COLUMN "timerEndsAt" TIMESTAMP(3);
ALTER TABLE "Classroom" ADD COLUMN "timerLabel" TEXT;
