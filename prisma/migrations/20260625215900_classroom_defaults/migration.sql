-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "allowStudentBoot" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultDurationMin" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "defaultOs" TEXT NOT NULL DEFAULT 'linux';
