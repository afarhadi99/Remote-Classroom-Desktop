-- LTI 1.3 Tool Provider: platforms, signing keys, launch nonces, and JIT-provisioning identity.
ALTER TABLE "Teacher" ADD COLUMN "ltiPlatformId" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "ltiSub" TEXT;
CREATE UNIQUE INDEX "Teacher_ltiPlatformId_ltiSub_key" ON "Teacher"("ltiPlatformId", "ltiSub");

ALTER TABLE "Classroom" ADD COLUMN "ltiPlatformId" TEXT;
ALTER TABLE "Classroom" ADD COLUMN "ltiContextId" TEXT;
CREATE UNIQUE INDEX "Classroom_ltiPlatformId_ltiContextId_key" ON "Classroom"("ltiPlatformId", "ltiContextId");

CREATE TABLE "LtiPlatform" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authLoginUrl" TEXT NOT NULL,
    "authTokenUrl" TEXT NOT NULL,
    "jwksUrl" TEXT NOT NULL,
    "deploymentIds" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LtiPlatform_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LtiPlatform_issuer_clientId_key" ON "LtiPlatform"("issuer", "clientId");

CREATE TABLE "LtiKey" (
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "publicJwk" TEXT NOT NULL,
    "privatePem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LtiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LtiKey_kid_key" ON "LtiKey"("kid");

CREATE TABLE "LtiNonce" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LtiNonce_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LtiNonce_state_key" ON "LtiNonce"("state");
CREATE INDEX "LtiNonce_expiresAt_idx" ON "LtiNonce"("expiresAt");
