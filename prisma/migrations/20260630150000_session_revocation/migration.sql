-- "Sign out everywhere": reject sessions issued before this cutoff.
ALTER TABLE "Teacher" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
ALTER TABLE "Admin" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
