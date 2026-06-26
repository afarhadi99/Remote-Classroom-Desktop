-- Machine: store the Daytona private-preview token so the reverse proxy can inject it
ALTER TABLE "Machine" ADD COLUMN     "previewToken" TEXT;
