-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED', 'DEAD_LETTERED');

-- CreateTable
CREATE TABLE "events" (
    "id"           TEXT         NOT NULL,
    "type"         TEXT         NOT NULL,
    "source"       TEXT         NOT NULL DEFAULT 'api',
    "payload"      JSONB        NOT NULL,
    "status"       "EventStatus" NOT NULL DEFAULT 'QUEUED',
    "apiKeyId"     TEXT,
    "attempts"     INTEGER      NOT NULL DEFAULT 0,
    "jobId"        TEXT,
    "errorMessage" TEXT,
    "processedAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id"        TEXT         NOT NULL,
    "key"       TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "rateLimit" INTEGER      NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "value"     DOUBLE PRECISION NOT NULL,
    "labels"    JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "events_jobId_key" ON "events"("jobId");
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "events_status_idx"    ON "events"("status");
CREATE INDEX "events_type_idx"      ON "events"("type");
CREATE INDEX "events_createdAt_idx" ON "events"("createdAt");
CREATE INDEX "events_apiKeyId_idx"  ON "events"("apiKeyId");
CREATE INDEX "api_keys_key_idx"     ON "api_keys"("key");
CREATE INDEX "metrics_name_timestamp_idx" ON "metrics"("name", "timestamp");
