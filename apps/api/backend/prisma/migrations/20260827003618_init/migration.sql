-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CITIZEN', 'MANAGER', 'ADMIN', 'RESEARCHER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('DRAFT', 'PENDING_SYNC', 'SYNCED', 'UNDER_REVIEW', 'NEEDS_MORE_INFO', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "MediaOrigin" AS ENUM ('INITIAL', 'COMPLEMENT');

-- CreateEnum
CREATE TYPE "AIModelType" AS ENUM ('VISUAL', 'TEXTUAL', 'MULTIMODAL', 'RISK_PREDICTION');

-- CreateEnum
CREATE TYPE "AIResultStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'ERROR');

-- CreateEnum
CREATE TYPE "ValidationDecision" AS ENUM ('CONFIRM', 'REJECT', 'CORRECT', 'REQUEST_MORE_INFO');

-- CreateEnum
CREATE TYPE "ComplementRequestStatus" AS ENUM ('OPEN', 'ANSWERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskTrend" AS ENUM ('DECREASING', 'STABLE', 'INCREASING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('SYNTHETIC', 'INPE', 'RAINFALL', 'RIVER_LEVEL', 'WEATHER_STATION', 'SATELLITE', 'HISTORICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrityFlagType" AS ENUM ('DUPLICATE', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CITIZEN',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_invites" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdByAdminId" UUID NOT NULL,
    "acceptedByUserId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_categories" (
    "id" UUID NOT NULL,
    "cobradeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disaster_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrences" (
    "id" UUID NOT NULL,
    "clientLocalId" TEXT,
    "idempotencyKey" TEXT,
    "reporterId" UUID NOT NULL,
    "confirmedCategoryId" UUID,
    "description" TEXT,
    "urgency" "UrgencyLevel" NOT NULL DEFAULT 'MEDIUM',
    "humanRisk" BOOLEAN NOT NULL DEFAULT false,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "locationSource" "LocationSource" NOT NULL,
    "locationAccuracyM" DECIMAL(8,2),
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_media" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "complementId" UUID,
    "type" "MediaType" NOT NULL,
    "origin" "MediaOrigin" NOT NULL DEFAULT 'INITIAL',
    "mimeType" TEXT NOT NULL,
    "storageRef" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "durationSec" INTEGER,
    "sha256" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrence_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_versions" (
    "id" UUID NOT NULL,
    "modelType" "AIModelType" NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "algorithm" TEXT,
    "framework" TEXT,
    "metrics" JSONB,
    "parameters" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "syntheticData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_classifications" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "modelVersionId" UUID NOT NULL,
    "predictedCategoryId" UUID,
    "resultStatus" "AIResultStatus" NOT NULL DEFAULT 'AVAILABLE',
    "confidence" DECIMAL(5,4),
    "visualConfidence" DECIMAL(5,4),
    "textConfidence" DECIMAL(5,4),
    "ambiguous" BOOLEAN NOT NULL DEFAULT false,
    "ambiguityReason" TEXT,
    "explanationSimple" TEXT,
    "signals" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validations" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "decision" "ValidationDecision" NOT NULL,
    "finalCategoryId" UUID,
    "rejectionReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "fromStatus" "OccurrenceStatus",
    "toStatus" "OccurrenceStatus" NOT NULL,
    "changedByUserId" UUID,
    "actorType" "ActorType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "information_requests" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ComplementRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "information_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_complements" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "citizenId" UUID NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrence_complements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confidence_thresholds" (
    "id" UUID NOT NULL,
    "categoryId" UUID,
    "createdById" UUID NOT NULL,
    "modelType" "AIModelType" NOT NULL,
    "lowUpperBound" DECIMAL(5,4) NOT NULL,
    "mediumUpperBound" DECIMAL(5,4) NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confidence_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DataSourceType" NOT NULL,
    "externalRef" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_predictions" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "modelVersionId" UUID NOT NULL,
    "regionKey" TEXT NOT NULL,
    "regionName" TEXT NOT NULL,
    "centerLatitude" DECIMAL(9,6),
    "centerLongitude" DECIMAL(9,6),
    "horizonHours" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "probability" DECIMAL(5,4),
    "trend" "RiskTrend" NOT NULL DEFAULT 'UNKNOWN',
    "factors" JSONB,
    "explanationSimple" TEXT,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_sources" (
    "id" UUID NOT NULL,
    "predictionId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "datasetVersion" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "prediction_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_flags" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "relatedOccurrenceId" UUID,
    "resolvedByUserId" UUID,
    "type" "IntegrityFlagType" NOT NULL,
    "score" DECIMAL(5,4),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "integrity_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "filters" JSONB,
    "anonymized" BOOLEAN NOT NULL DEFAULT true,
    "fileRef" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "manager_invites_tokenHash_key" ON "manager_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "manager_invites_email_idx" ON "manager_invites"("email");

-- CreateIndex
CREATE INDEX "manager_invites_expiresAt_idx" ON "manager_invites"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "disaster_categories_cobradeCode_key" ON "disaster_categories"("cobradeCode");

-- CreateIndex
CREATE INDEX "disaster_categories_active_idx" ON "disaster_categories"("active");

-- CreateIndex
CREATE UNIQUE INDEX "occurrences_clientLocalId_key" ON "occurrences"("clientLocalId");

-- CreateIndex
CREATE UNIQUE INDEX "occurrences_idempotencyKey_key" ON "occurrences"("idempotencyKey");

-- CreateIndex
CREATE INDEX "occurrences_status_reportedAt_idx" ON "occurrences"("status", "reportedAt");

-- CreateIndex
CREATE INDEX "occurrences_latitude_longitude_idx" ON "occurrences"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "occurrences_reporterId_reportedAt_idx" ON "occurrences"("reporterId", "reportedAt");

-- CreateIndex
CREATE INDEX "occurrences_confirmedCategoryId_status_idx" ON "occurrences"("confirmedCategoryId", "status");

-- CreateIndex
CREATE INDEX "occurrence_media_occurrenceId_type_idx" ON "occurrence_media"("occurrenceId", "type");

-- CreateIndex
CREATE INDEX "occurrence_media_complementId_idx" ON "occurrence_media"("complementId");

-- CreateIndex
CREATE INDEX "occurrence_media_sha256_idx" ON "occurrence_media"("sha256");

-- CreateIndex
CREATE INDEX "model_versions_modelType_active_idx" ON "model_versions"("modelType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "model_versions_modelType_name_version_key" ON "model_versions"("modelType", "name", "version");

-- CreateIndex
CREATE INDEX "ai_classifications_occurrenceId_createdAt_idx" ON "ai_classifications"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_classifications_predictedCategoryId_confidence_idx" ON "ai_classifications"("predictedCategoryId", "confidence");

-- CreateIndex
CREATE INDEX "ai_classifications_modelVersionId_idx" ON "ai_classifications"("modelVersionId");

-- CreateIndex
CREATE INDEX "validations_occurrenceId_createdAt_idx" ON "validations"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "validations_managerId_createdAt_idx" ON "validations"("managerId", "createdAt");

-- CreateIndex
CREATE INDEX "status_history_occurrenceId_createdAt_idx" ON "status_history"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "status_history_toStatus_createdAt_idx" ON "status_history"("toStatus", "createdAt");

-- CreateIndex
CREATE INDEX "information_requests_occurrenceId_status_idx" ON "information_requests"("occurrenceId", "status");

-- CreateIndex
CREATE INDEX "occurrence_complements_occurrenceId_createdAt_idx" ON "occurrence_complements"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "occurrence_complements_requestId_idx" ON "occurrence_complements"("requestId");

-- CreateIndex
CREATE INDEX "confidence_thresholds_modelType_active_idx" ON "confidence_thresholds"("modelType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "confidence_thresholds_categoryId_modelType_version_key" ON "confidence_thresholds"("categoryId", "modelType", "version");

-- CreateIndex
CREATE INDEX "data_sources_type_active_idx" ON "data_sources"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_name_type_key" ON "data_sources"("name", "type");

-- CreateIndex
CREATE INDEX "risk_predictions_regionKey_categoryId_horizonHours_createdA_idx" ON "risk_predictions"("regionKey", "categoryId", "horizonHours", "createdAt");

-- CreateIndex
CREATE INDEX "risk_predictions_riskLevel_validFrom_idx" ON "risk_predictions"("riskLevel", "validFrom");

-- CreateIndex
CREATE INDEX "prediction_sources_predictionId_idx" ON "prediction_sources"("predictionId");

-- CreateIndex
CREATE INDEX "prediction_sources_sourceId_retrievedAt_idx" ON "prediction_sources"("sourceId", "retrievedAt");

-- CreateIndex
CREATE INDEX "integrity_flags_occurrenceId_type_resolvedAt_idx" ON "integrity_flags"("occurrenceId", "type", "resolvedAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_requestedById_createdAt_idx" ON "export_jobs"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_status_createdAt_idx" ON "export_jobs"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_invites" ADD CONSTRAINT "manager_invites_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_confirmedCategoryId_fkey" FOREIGN KEY ("confirmedCategoryId") REFERENCES "disaster_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_media" ADD CONSTRAINT "occurrence_media_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_media" ADD CONSTRAINT "occurrence_media_complementId_fkey" FOREIGN KEY ("complementId") REFERENCES "occurrence_complements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "model_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_predictedCategoryId_fkey" FOREIGN KEY ("predictedCategoryId") REFERENCES "disaster_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validations" ADD CONSTRAINT "validations_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validations" ADD CONSTRAINT "validations_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validations" ADD CONSTRAINT "validations_finalCategoryId_fkey" FOREIGN KEY ("finalCategoryId") REFERENCES "disaster_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_complements" ADD CONSTRAINT "occurrence_complements_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_complements" ADD CONSTRAINT "occurrence_complements_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "information_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_complements" ADD CONSTRAINT "occurrence_complements_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confidence_thresholds" ADD CONSTRAINT "confidence_thresholds_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "disaster_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confidence_thresholds" ADD CONSTRAINT "confidence_thresholds_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_predictions" ADD CONSTRAINT "risk_predictions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "disaster_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_predictions" ADD CONSTRAINT "risk_predictions_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "model_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_sources" ADD CONSTRAINT "prediction_sources_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "risk_predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_sources" ADD CONSTRAINT "prediction_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_flags" ADD CONSTRAINT "integrity_flags_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_flags" ADD CONSTRAINT "integrity_flags_relatedOccurrenceId_fkey" FOREIGN KEY ("relatedOccurrenceId") REFERENCES "occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_flags" ADD CONSTRAINT "integrity_flags_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
