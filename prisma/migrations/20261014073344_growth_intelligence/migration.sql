-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('FACT', 'OBSERVATION', 'INFERENCE', 'HYPOTHESIS', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'NOT_CONNECTED', 'MANUAL_IMPORT', 'REQUIRES_API', 'REQUIRES_USER_AUTH');

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('DRAFT', 'APPROVED', 'SHARED');

-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN     "changeFromPrevious" TEXT,
ADD COLUMN     "supersedesId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "source" TEXT NOT NULL,
    "sourceTimestamp" TIMESTAMP(3) NOT NULL,
    "evidence" TEXT,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "momentum" TEXT,
    "commercialPotential" TEXT,
    "submittedByOperator" BOOLEAN NOT NULL DEFAULT false,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL,
    "notes" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthBrief" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "whatChanged" JSONB NOT NULL,
    "whyItMatters" TEXT,
    "actions" JSONB NOT NULL,
    "learnings" TEXT,
    "dataGaps" TEXT[],
    "generatedBy" TEXT NOT NULL,
    "status" "BriefStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OpportunityToSignal" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OpportunityToSignal_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Signal_operatorId_createdAt_idx" ON "Signal"("operatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_operatorId_sourceKey_key" ON "IntegrationConnection"("operatorId", "sourceKey");

-- CreateIndex
CREATE INDEX "GrowthBrief_operatorId_weekOf_idx" ON "GrowthBrief"("operatorId", "weekOf");

-- CreateIndex
CREATE INDEX "_OpportunityToSignal_B_index" ON "_OpportunityToSignal"("B");

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthBrief" ADD CONSTRAINT "GrowthBrief_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OpportunityToSignal" ADD CONSTRAINT "_OpportunityToSignal_A_fkey" FOREIGN KEY ("A") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OpportunityToSignal" ADD CONSTRAINT "_OpportunityToSignal_B_fkey" FOREIGN KEY ("B") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
