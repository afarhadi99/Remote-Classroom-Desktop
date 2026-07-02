-- Two-factor auth (TOTP) for teacher accounts.
ALTER TABLE "Teacher" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Teacher" ADD COLUMN "totpBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
