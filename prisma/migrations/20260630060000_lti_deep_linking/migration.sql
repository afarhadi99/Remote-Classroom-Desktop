-- LTI Deep Linking session (return URL + opaque data between request and selection).
CREATE TABLE "LtiDeepLinkSession" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "returnUrl" TEXT NOT NULL,
    "data" TEXT,
    "teacherId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LtiDeepLinkSession_pkey" PRIMARY KEY ("id")
);
