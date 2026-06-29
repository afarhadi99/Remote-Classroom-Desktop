-- v2 feature batch: announcements, join PINs, connection saver, bell-schedule shutdown.

-- Class announcements + per-class join-PIN requirement.
ALTER TABLE "Classroom" ADD COLUMN     "announcement" TEXT;
ALTER TABLE "Classroom" ADD COLUMN     "announcementAt" TIMESTAMP(3);
ALTER TABLE "Classroom" ADD COLUMN     "requireJoinPin" BOOLEAN NOT NULL DEFAULT false;

-- Per-student join PIN (bcrypt hash) + low-bandwidth streaming preference.
ALTER TABLE "Student" ADD COLUMN     "joinPin" TEXT;
ALTER TABLE "Student" ADD COLUMN     "connectionSaver" BOOLEAN NOT NULL DEFAULT false;

-- Bell-schedule auto-shutdown: optional end time + once-per-day guard.
ALTER TABLE "ClassSchedule" ADD COLUMN     "endMinute" INTEGER;
ALTER TABLE "ClassSchedule" ADD COLUMN     "lastShutdownOn" TEXT;
