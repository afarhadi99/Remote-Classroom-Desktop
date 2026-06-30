-- Per-student focus lock.
ALTER TABLE "Student" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "lockMessage" TEXT;
