-- Private 1:1 teacher-to-student nudge.
ALTER TABLE "Student" ADD COLUMN "nudge" TEXT;
ALTER TABLE "Student" ADD COLUMN "nudgeAt" TIMESTAMP(3);
