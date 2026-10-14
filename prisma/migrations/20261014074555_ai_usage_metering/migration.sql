-- CreateTable
CREATE TABLE "ModelRate" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL,
    "inputMicrosPerMTok" INTEGER NOT NULL,
    "outputMicrosPerMTok" INTEGER NOT NULL,
    "cacheWriteMicrosPerMTok" INTEGER NOT NULL,
    "cacheReadMicrosPerMTok" INTEGER NOT NULL,
    "batchDiscountPercent" INTEGER NOT NULL DEFAULT 50,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL,
    "workflowKey" TEXT,
    "agentKey" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "isBatch" BOOLEAN NOT NULL DEFAULT false,
    "costMicrosUsd" INTEGER NOT NULL,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "level" TEXT NOT NULL,
    "usedMicrosUsd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelRate_provider_model_effectiveFrom_key" ON "ModelRate"("provider", "model", "effectiveFrom");

-- CreateIndex
CREATE INDEX "UsageRecord_organizationId_occurredAt_idx" ON "UsageRecord"("organizationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_organizationId_idempotencyKey_key" ON "UsageRecord"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "UsageAlert_organizationId_periodStart_level_key" ON "UsageAlert"("organizationId", "periodStart", "level");

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageAlert" ADD CONSTRAINT "UsageAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
