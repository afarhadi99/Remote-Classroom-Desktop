-- Internet policy + exam mode
ALTER TABLE "Classroom" ADD COLUMN     "netMode" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "Classroom" ADD COLUMN     "allowedDomains" TEXT;
ALTER TABLE "Classroom" ADD COLUMN     "examMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Classroom" ADD COLUMN     "examMessage" TEXT;
