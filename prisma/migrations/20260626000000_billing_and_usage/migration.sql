-- Teacher: billing / plan fields
ALTER TABLE "Teacher" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Teacher" ADD COLUMN     "stripeCustomerId" TEXT;
ALTER TABLE "Teacher" ADD COLUMN     "stripeSubscriptionId" TEXT;
ALTER TABLE "Teacher" ADD COLUMN     "planStatus" TEXT;
ALTER TABLE "Teacher" ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3);

-- Student: monthly usage tracking
ALTER TABLE "Student" ADD COLUMN     "usageMonth" TEXT;
ALTER TABLE "Student" ADD COLUMN     "usageMinutes" INTEGER NOT NULL DEFAULT 0;

-- Unique index for Stripe customer id
CREATE UNIQUE INDEX "Teacher_stripeCustomerId_key" ON "Teacher"("stripeCustomerId");
