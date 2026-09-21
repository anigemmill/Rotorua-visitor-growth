-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('PUBLIC', 'PARTNER', 'PRIVATE_BUSINESS', 'AGGREGATED', 'MODEL_INFERENCE');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('VERIFIED', 'HIGH', 'MEDIUM', 'LOW', 'MODELLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PUBLIC', 'PARTNER', 'BUSINESS', 'ADMIN');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('CONNECTED', 'NOT_CONNECTED', 'MANUAL_IMPORT_ONLY', 'ERROR');

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "licence" TEXT,
    "defaultAccessLevel" "AccessLevel" NOT NULL DEFAULT 'PUBLIC',
    "connectorStatus" "ConnectorStatus" NOT NULL DEFAULT 'MANUAL_IMPORT_ONLY',
    "connectorKey" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "targetTable" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "geography" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorMetric" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "originMarket" TEXT,
    "isInternational" BOOLEAN,
    "visitorPurpose" TEXT,
    "geography" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationProperty" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "roomCount" INTEGER,
    "businessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccommodationProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationMetric" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "propertyId" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "accommodationType" TEXT,
    "geography" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccommodationMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ExperienceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "businessId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "geography" TEXT NOT NULL,
    "isBookable" BOOLEAN NOT NULL DEFAULT false,
    "websiteUrl" TEXT,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PUBLIC',
    "confidence" "Confidence" NOT NULL DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandSignal" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedPrompt" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIVisibilityCheck" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "aiSystem" TEXT NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "destinationMentioned" BOOLEAN NOT NULL,
    "mentionPosition" INTEGER,
    "experiencesRecommended" TEXT[],
    "competitorsMentioned" TEXT[],
    "citedSources" TEXT[],
    "factualIssues" TEXT[],
    "confidence" "Confidence" NOT NULL DEFAULT 'MODELLED',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PARTNER',
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIVisibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherObservation" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "temperatureC" DOUBLE PRECISION NOT NULL,
    "conditionCode" TEXT NOT NULL,
    "windSpeedKmh" DOUBLE PRECISION,
    "precipitationMm" DOUBLE PRECISION,
    "geography" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'VERIFIED',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherForecast" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "forDate" TIMESTAMP(3) NOT NULL,
    "temperatureMinC" DOUBLE PRECISION NOT NULL,
    "temperatureMaxC" DOUBLE PRECISION NOT NULL,
    "conditionCode" TEXT NOT NULL,
    "precipitationProbability" DOUBLE PRECISION,
    "geography" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "regional" BOOLEAN NOT NULL DEFAULT false,
    "countiesOrRegions" TEXT[],
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PUBLIC',
    "confidence" "Confidence" NOT NULL DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportDisruption" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportDisruption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityRecord" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "experienceId" TEXT,
    "capacityType" TEXT NOT NULL,
    "totalCapacity" DOUBLE PRECISION,
    "availableCapacity" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "verifiedAvailable" BOOLEAN NOT NULL DEFAULT false,
    "geography" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestinationEvent" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "expectedAttendance" INTEGER,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DestinationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessContribution" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contributionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PRIVATE_BUSINESS',
    "submittedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOpportunity" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "travellerType" TEXT NOT NULL,
    "demandSignal" TEXT NOT NULL,
    "currentPerformance" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "productFit" TEXT NOT NULL,
    "gap" TEXT NOT NULL,
    "potential" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "dataNeeded" TEXT[],
    "evidenceRefs" JSONB NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'MODELLED',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductGap" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "targetVisitor" TEXT NOT NULL,
    "demandSignal" TEXT NOT NULL,
    "currentSupply" TEXT NOT NULL,
    "gap" TEXT NOT NULL,
    "potentialProduct" TEXT NOT NULL,
    "potentialPartners" TEXT[],
    "seasonality" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "commercialConsiderations" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "dataNeeded" TEXT[],
    "evidenceRefs" JSONB NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'MODELLED',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partnership" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "participants" TEXT[],
    "rationale" TEXT NOT NULL,
    "targetOutcome" TEXT NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'MODELLED',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Itinerary" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visitorType" TEXT NOT NULL,
    "nights" INTEGER NOT NULL,
    "interests" TEXT[],
    "itineraryJson" JSONB NOT NULL,
    "optimisedFor" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Itinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "measurement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioQuery" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "askedBy" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "inferences" JSONB NOT NULL,
    "hypotheses" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "insufficientData" TEXT[],
    "llmAssisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_destinationId_name_key" ON "DataSource"("destinationId", "name");

-- CreateIndex
CREATE INDEX "VisitorMetric_destinationId_metric_periodStart_idx" ON "VisitorMetric"("destinationId", "metric", "periodStart");

-- CreateIndex
CREATE INDEX "AccommodationMetric_destinationId_metric_periodStart_idx" ON "AccommodationMetric"("destinationId", "metric", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceCategory_slug_key" ON "ExperienceCategory"("slug");

-- CreateIndex
CREATE INDEX "Experience_destinationId_categoryId_idx" ON "Experience"("destinationId", "categoryId");

-- CreateIndex
CREATE INDEX "DemandSignal_destinationId_signalType_periodStart_idx" ON "DemandSignal"("destinationId", "signalType", "periodStart");

-- CreateIndex
CREATE INDEX "AIVisibilityCheck_destinationId_promptId_runAt_idx" ON "AIVisibilityCheck"("destinationId", "promptId", "runAt");

-- CreateIndex
CREATE INDEX "WeatherObservation_destinationId_observedAt_idx" ON "WeatherObservation"("destinationId", "observedAt");

-- CreateIndex
CREATE INDEX "WeatherForecast_destinationId_forDate_idx" ON "WeatherForecast"("destinationId", "forDate");

-- CreateIndex
CREATE INDEX "PublicHoliday_destinationId_date_idx" ON "PublicHoliday"("destinationId", "date");

-- CreateIndex
CREATE INDEX "CapacityRecord_destinationId_capacityType_periodStart_idx" ON "CapacityRecord"("destinationId", "capacityType", "periodStart");

-- CreateIndex
CREATE INDEX "DestinationEvent_destinationId_startsAt_idx" ON "DestinationEvent"("destinationId", "startsAt");

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorMetric" ADD CONSTRAINT "VisitorMetric_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorMetric" ADD CONSTRAINT "VisitorMetric_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationProperty" ADD CONSTRAINT "AccommodationProperty_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationProperty" ADD CONSTRAINT "AccommodationProperty_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationMetric" ADD CONSTRAINT "AccommodationMetric_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationMetric" ADD CONSTRAINT "AccommodationMetric_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationMetric" ADD CONSTRAINT "AccommodationMetric_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "AccommodationProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExperienceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandSignal" ADD CONSTRAINT "DemandSignal_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandSignal" ADD CONSTRAINT "DemandSignal_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedPrompt" ADD CONSTRAINT "TrackedPrompt_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIVisibilityCheck" ADD CONSTRAINT "AIVisibilityCheck_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIVisibilityCheck" ADD CONSTRAINT "AIVisibilityCheck_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIVisibilityCheck" ADD CONSTRAINT "AIVisibilityCheck_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "TrackedPrompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherObservation" ADD CONSTRAINT "WeatherObservation_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherObservation" ADD CONSTRAINT "WeatherObservation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherForecast" ADD CONSTRAINT "WeatherForecast_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherForecast" ADD CONSTRAINT "WeatherForecast_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicHoliday" ADD CONSTRAINT "PublicHoliday_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicHoliday" ADD CONSTRAINT "PublicHoliday_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDisruption" ADD CONSTRAINT "TransportDisruption_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDisruption" ADD CONSTRAINT "TransportDisruption_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityRecord" ADD CONSTRAINT "CapacityRecord_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityRecord" ADD CONSTRAINT "CapacityRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityRecord" ADD CONSTRAINT "CapacityRecord_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestinationEvent" ADD CONSTRAINT "DestinationEvent_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestinationEvent" ADD CONSTRAINT "DestinationEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContribution" ADD CONSTRAINT "BusinessContribution_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOpportunity" ADD CONSTRAINT "MarketOpportunity_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGap" ADD CONSTRAINT "ProductGap_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Itinerary" ADD CONSTRAINT "Itinerary_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioQuery" ADD CONSTRAINT "ScenarioQuery_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
