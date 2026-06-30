-- API idempotency: cache the response of a mutating call per (apiKey, Idempotency-Key).
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "idemKey" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdempotencyKey_keyId_idemKey_key" ON "IdempotencyKey"("keyId", "idemKey");
