-- Classroom: configurable idle auto-stop
ALTER TABLE "Classroom" ADD COLUMN     "idleTimeoutMin" INTEGER NOT NULL DEFAULT 20;

-- Machine: teacher "watching" heartbeat for the student transparency banner
ALTER TABLE "Machine" ADD COLUMN     "watchedUntil" TIMESTAMP(3);
