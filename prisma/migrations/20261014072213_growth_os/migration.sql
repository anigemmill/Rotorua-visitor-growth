-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FOUNDER', 'ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'COHORT', 'AGGREGATE_APPROVED', 'PUBLIC_APPROVED');

-- CreateEnum
CREATE TYPE "OperatorStatus" AS ENUM ('PROSPECT', 'INVITED', 'ONBOARDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Horizon" AS ENUM ('NOW', 'NEXT', 'LATER', 'IGNORE');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('OBSERVED', 'OPERATOR_REPORTED', 'MEASURED', 'THIRD_PARTY', 'HYPOTHESIS');

-- CreateEnum
CREATE TYPE "SolutionType" AS ENUM ('AI_ASSISTED', 'AUTOMATION', 'PROCESS_CHANGE', 'WEBSITE_CONTENT', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('IDENTIFIED', 'PRIORITISED', 'APPROVED', 'IN_PROGRESS', 'LIVE', 'MEASURING', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('SCALE', 'AMEND', 'STOP', 'INVESTIGATE');

-- CreateEnum
CREATE TYPE "AssessmentArea" AS ENUM ('AI_SEARCH_VISIBILITY', 'MARKETING_CONTENT', 'ENQUIRIES_CONVERSION', 'BOOKING_JOURNEY', 'GUEST_COMMUNICATIONS', 'ADMIN_WORKLOAD', 'REPORTING_DECISIONS', 'OPERATIONS', 'FEEDBACK_PRODUCT');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DESIGN', 'RUNNING', 'ANALYSING', 'COMPLETE', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ComparisonMethod" AS ENUM ('BEFORE_AFTER', 'CONTROL_GROUP', 'MATCHED_COMPARISON', 'NONE');

-- CreateEnum
CREATE TYPE "MetricKey" AS ENUM ('QUALIFIED_ENQUIRIES', 'BOOKING_CONVERSION', 'BOOKING_VALUE', 'ATTRIBUTABLE_REVENUE', 'GUEST_NIGHTS', 'TIME_SAVED_HOURS', 'COST_PER_BOOKING', 'AI_SEARCH_VISIBILITY', 'REFERRAL_TRAFFIC', 'GUEST_SATISFACTION', 'TOTAL_BOOKINGS', 'OTHER');

-- CreateEnum
CREATE TYPE "MeasurementKind" AS ENUM ('BASELINE', 'RESULT');

-- CreateEnum
CREATE TYPE "CulturalReview" AS ENUM ('NOT_APPLICABLE', 'REQUIRED', 'APPROVED');

-- CreateEnum
CREATE TYPE "WorkflowKind" AS ENUM ('CONCEPT_SPEC', 'PROMPT_TEMPLATE', 'AUTOMATED_WORKFLOW', 'AGENT');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('CONCEPT', 'TESTING', 'VALIDATED', 'OPERATIONAL', 'RETIRED');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('PARTICIPATION_FEE', 'SPONSORSHIP', 'IMPLEMENTATION', 'RECURRING_SERVICE', 'LICENSING', 'OTHER');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('OPPORTUNITY', 'PROPOSED', 'QUOTED', 'CONTRACTED', 'LOST');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('DELIVERY_LABOUR', 'CONTRACTOR', 'SOFTWARE', 'TRAVEL', 'VENUE', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskKind" AS ENUM ('RISK', 'BLOCKER', 'ISSUE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "operatorId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "totalWeeks" INTEGER NOT NULL DEFAULT 12,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeStage" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "endWeek" INTEGER NOT NULL,
    "goals" TEXT[],

    CONSTRAINT "ProgrammeStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'TODO',
    "notes" TEXT,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "OperatorStatus" NOT NULL DEFAULT 'PROSPECT',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    "bookingUrl" TEXT,
    "experiences" TEXT,
    "targetMarkets" TEXT[],
    "marketingChannels" TEXT[],
    "bookingProcess" TEXT,
    "techStack" TEXT[],
    "objectives" TEXT,
    "challenges" TEXT,
    "aiMaturity" INTEGER,
    "seasonality" TEXT,
    "groupTags" TEXT[],
    "internalNotes" TEXT,
    "agreedScope" TEXT,
    "dataAgreementSignedAt" TIMESTAMP(3),
    "consentCohortSharing" BOOLEAN NOT NULL DEFAULT false,
    "consentAggregate" BOOLEAN NOT NULL DEFAULT false,
    "consentCaseStudy" BOOLEAN NOT NULL DEFAULT false,
    "dataRetentionNotes" TEXT,
    "culturalGuidance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "conductedBy" TEXT,
    "conductedAt" TIMESTAMP(3),
    "summary" TEXT,
    "sharedWithOperator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAreaScore" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "area" "AssessmentArea" NOT NULL,
    "score" INTEGER,
    "observed" TEXT,
    "reported" TEXT,
    "notes" TEXT,

    CONSTRAINT "AssessmentAreaScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" "AssessmentArea" NOT NULL,
    "solutionType" "SolutionType" NOT NULL,
    "description" TEXT NOT NULL,
    "steps" TEXT,
    "typicalEffortHours" INTEGER,
    "typicalOneOffNzd" DOUBLE PRECISION,
    "typicalMonthlyNzd" DOUBLE PRECISION,
    "tools" TEXT[],
    "successMetric" TEXT,
    "workflowAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolutionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "initiativeId" TEXT,
    "assessmentId" TEXT,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "area" "AssessmentArea" NOT NULL,
    "solutionType" "SolutionType" NOT NULL,
    "problem" TEXT NOT NULL,
    "currentProcess" TEXT,
    "proposedSolution" TEXT NOT NULL,
    "expectedValue" TEXT,
    "expectedValueNzd" DOUBLE PRECISION,
    "impactScore" INTEGER NOT NULL DEFAULT 3,
    "effortScore" INTEGER NOT NULL DEFAULT 3,
    "effortHours" INTEGER,
    "oneOffCostNzd" DOUBLE PRECISION,
    "monthlyCostNzd" DOUBLE PRECISION,
    "dataRequirements" TEXT,
    "risks" TEXT,
    "dependencies" TEXT,
    "tools" TEXT[],
    "successMetric" TEXT,
    "baselineMetric" TEXT,
    "targetMetric" TEXT,
    "actualResult" TEXT,
    "evidenceBasis" "EvidenceKind" NOT NULL DEFAULT 'HYPOTHESIS',
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "horizon" "Horizon" NOT NULL DEFAULT 'NEXT',
    "status" "OpportunityStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "decision" "Decision",
    "decisionNotes" TEXT,
    "ownerId" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "operatorId" TEXT,
    "opportunityId" TEXT,
    "initiativeId" TEXT,
    "status" "WorkStatus" NOT NULL DEFAULT 'TODO',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "tools" TEXT[],
    "oneOffCostNzd" DOUBLE PRECISION,
    "monthlyCostNzd" DOUBLE PRECISION,
    "testingNotes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "adoption" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "operatorId" TEXT,
    "projectId" TEXT,
    "initiativeId" TEXT,
    "workshopId" TEXT,
    "assigneeId" TEXT,
    "ownerLabel" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "WorkStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Horizon" NOT NULL DEFAULT 'NOW',
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operatorId" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "recordedBy" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3),
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "location" TEXT,
    "agenda" TEXT,
    "notes" TEXT,
    "status" "WorkStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopAttendance" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "engagement" INTEGER,
    "notes" TEXT,

    CONSTRAINT "WorkshopAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Learning" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "topic" TEXT,
    "operatorId" TEXT,
    "workshopId" TEXT,
    "initiativeId" TEXT,
    "isReusableProcess" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'INTERNAL',
    "culturalReview" "CulturalReview" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "culturalApprovedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Learning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "resourceType" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'COHORT',
    "culturalReview" "CulturalReview" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedInitiative" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "initiativeType" TEXT NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'TODO',
    "attributionMethod" TEXT,
    "results" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedInitiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeParticipant" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "role" TEXT,
    "responsibilities" TEXT,
    "attributedBookings" INTEGER,
    "attributedRevenueNzd" DOUBLE PRECISION,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InitiativeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "operatorId" TEXT,
    "initiativeId" TEXT,
    "opportunityId" TEXT,
    "isDestinationLevel" BOOLEAN NOT NULL DEFAULT false,
    "hypothesis" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "audience" TEXT,
    "intervention" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "baselineStart" TIMESTAMP(3),
    "baselineEnd" TIMESTAMP(3),
    "comparisonMethod" "ComparisonMethod" NOT NULL DEFAULT 'BEFORE_AFTER',
    "primaryMetric" "MetricKey" NOT NULL,
    "primaryMetricLabel" TEXT,
    "secondaryMetrics" TEXT[],
    "baselineValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "minimumAcceptable" DOUBLE PRECISION,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "maxCostNzd" DOUBLE PRECISION,
    "actualValue" DOUBLE PRECISION,
    "actualCostNzd" DOUBLE PRECISION,
    "controlValue" DOUBLE PRECISION,
    "resultSummary" TEXT,
    "limitations" TEXT,
    "attributionNotes" TEXT,
    "incrementalVisitors" DOUBLE PRECISION,
    "incrementalGuestNights" DOUBLE PRECISION,
    "incrementalSpendNzd" DOUBLE PRECISION,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DESIGN',
    "decision" "Decision",
    "nextAction" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "experimentId" TEXT,
    "metric" "MetricKey" NOT NULL,
    "label" TEXT,
    "kind" "MeasurementKind" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "evidenceKind" "EvidenceKind" NOT NULL DEFAULT 'OPERATOR_REPORTED',
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "kind" "RiskKind" NOT NULL DEFAULT 'RISK',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "operatorId" TEXT,
    "owner" TEXT,
    "mitigation" TEXT,
    "status" "WorkStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionRecord" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "whatChanged" TEXT NOT NULL,
    "evidence" TEXT,
    "whyItMatters" TEXT,
    "nextAction" TEXT,
    "owner" TEXT,
    "reviewDate" TIMESTAMP(3),
    "operatorId" TEXT,
    "decided" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WorkflowKind" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'CONCEPT',
    "purpose" TEXT NOT NULL,
    "problem" TEXT,
    "intendedUser" TEXT,
    "inputs" TEXT,
    "expectedOutput" TEXT,
    "tools" TEXT[],
    "permissions" TEXT,
    "humanApproval" TEXT,
    "costNotes" TEXT,
    "limitations" TEXT,
    "testResults" TEXT,
    "evidenceOfValue" TEXT,
    "culturalReview" "CulturalReview" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "strategicInitiative" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowUsage" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'piloting',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "operatorId" TEXT,
    "type" "DealType" NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'OPPORTUNITY',
    "oneOffValueNzd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyValueNzd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "termMonths" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 25,
    "expectedCloseDate" TIMESTAMP(3),
    "contractSignedAt" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "amountNzd" DOUBLE PRECISION NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostItem" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "amountNzd" DOUBLE PRECISION NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "isMonthly" BOOLEAN NOT NULL DEFAULT false,
    "isForecast" BOOLEAN NOT NULL DEFAULT false,
    "isIllustrative" BOOLEAN NOT NULL DEFAULT false,
    "dealId" TEXT,
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingScenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cohortSize" INTEGER NOT NULL,
    "feePerOperatorNzd" DOUBLE PRECISION NOT NULL,
    "sponsorshipNzd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implementationAttachRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implementationAvgNzd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recurringAttachRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recurringMonthlyNzd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recurringMonths" INTEGER NOT NULL DEFAULT 12,
    "deliveryHoursPerOperator" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharedDeliveryHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hourlyCostNzd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "softwareMonthlyNzd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "programmeMonths" INTEGER NOT NULL DEFAULT 3,
    "otherFixedCostsNzd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAreaScore_assessmentId_area_key" ON "AssessmentAreaScore"("assessmentId", "area");

-- CreateIndex
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Evidence_entityType_entityId_idx" ON "Evidence"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopAttendance_workshopId_operatorId_key" ON "WorkshopAttendance"("workshopId", "operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativeParticipant_initiativeId_operatorId_key" ON "InitiativeParticipant"("initiativeId", "operatorId");

-- CreateIndex
CREATE INDEX "Measurement_operatorId_metric_idx" ON "Measurement"("operatorId", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_assetId_version_key" ON "WorkflowVersion"("assetId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowUsage_assetId_operatorId_key" ON "WorkflowUsage"("assetId", "operatorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeStage" ADD CONSTRAINT "ProgrammeStage_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operator" ADD CONSTRAINT "Operator_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAreaScore" ADD CONSTRAINT "AssessmentAreaScore_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionTemplate" ADD CONSTRAINT "SolutionTemplate_workflowAssetId_fkey" FOREIGN KEY ("workflowAssetId") REFERENCES "WorkflowAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SharedInitiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SolutionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SharedInitiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SharedInitiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopAttendance" ADD CONSTRAINT "WorkshopAttendance_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopAttendance" ADD CONSTRAINT "WorkshopAttendance_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learning" ADD CONSTRAINT "Learning_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learning" ADD CONSTRAINT "Learning_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learning" ADD CONSTRAINT "Learning_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SharedInitiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedInitiative" ADD CONSTRAINT "SharedInitiative_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeParticipant" ADD CONSTRAINT "InitiativeParticipant_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SharedInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeParticipant" ADD CONSTRAINT "InitiativeParticipant_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SharedInitiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionRecord" ADD CONSTRAINT "DecisionRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "WorkflowAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowUsage" ADD CONSTRAINT "WorkflowUsage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "WorkflowAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowUsage" ADD CONSTRAINT "WorkflowUsage_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
