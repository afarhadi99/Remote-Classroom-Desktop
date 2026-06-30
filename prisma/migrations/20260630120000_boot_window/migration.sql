-- Quiet hours: allowed student self-boot window (minute-of-day, server local time).
ALTER TABLE "Classroom" ADD COLUMN "bootWindowStart" INTEGER;
ALTER TABLE "Classroom" ADD COLUMN "bootWindowEnd" INTEGER;
