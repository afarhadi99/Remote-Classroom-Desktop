-- Golden-image snapshot per class
ALTER TABLE "Classroom" ADD COLUMN     "snapshot" TEXT;

-- Panic / raise-hand flag per student
ALTER TABLE "Student" ADD COLUMN     "flaggedAt" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN     "flagKind" TEXT;
ALTER TABLE "Student" ADD COLUMN     "flagNote" TEXT;
