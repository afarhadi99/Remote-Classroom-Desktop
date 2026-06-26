-- Teacher cost guardrails
ALTER TABLE "Teacher" ADD COLUMN     "maxConcurrentDesktops" INTEGER;
ALTER TABLE "Teacher" ADD COLUMN     "monthlySpendCapCents" INTEGER;
