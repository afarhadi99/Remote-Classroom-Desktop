-- Classroom: "Eyes on me" focus lock
ALTER TABLE "Classroom" ADD COLUMN     "lockedAt" TIMESTAMP(3);
ALTER TABLE "Classroom" ADD COLUMN     "lockMessage" TEXT;

-- Reusable class templates
CREATE TABLE "ClassTemplate" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "os" TEXT NOT NULL DEFAULT 'linux',
    "durationMin" INTEGER NOT NULL DEFAULT 45,
    "allowStudentBoot" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
