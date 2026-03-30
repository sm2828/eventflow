// api/src/worker.ts
// Inline worker — runs inside the same process as the API server.
// Used on Render's free tier where only one web service is available.
import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redisConnection } from "./config/queue";
import { QUEUE_NAMES } from "../../shared/src/types/queue";
import { createLogger } from "../../shared/src/utils/logger";
import { processEvent } from "./processors/event.processor";

const logger = createLogger("inline-worker");
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);
const STALLED_INTERVAL_MS = parseInt(
  process.env.WORKER_STALLED_INTERVAL_MS ||
    (process.env.NODE_ENV === "production" ? "300000" : "30000"),
  10
);
const MAX_STALLED_COUNT = parseInt(process.env.WORKER_MAX_STALLED_COUNT || "1", 10);

export async function startInlineWorker(prisma: PrismaClient): Promise<{
  shutdown: () => Promise<void>;
}> {
  logger.info("Starting inline worker", {
    concurrency: CONCURRENCY,
    stalledIntervalMs: STALLED_INTERVAL_MS,
    maxStalledCount: MAX_STALLED_COUNT,
  });

  const worker = new Worker(
    QUEUE_NAMES.EVENTS,
    async (job) => {
      await processEvent(job, prisma);
    },
    {
      connection: redisConnection,
      concurrency: CONCURRENCY,
      stalledInterval: STALLED_INTERVAL_MS,
      maxStalledCount: MAX_STALLED_COUNT,
    }
  );

  worker.on("completed", (job) => {
    logger.info("Job completed", { jobId: job.id, name: job.name });
  });

  worker.on("failed", (job, err) => {
    logger.warn("Job failed", {
      jobId: job?.id,
      name: job?.name,
      attempts: job?.attemptsMade,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    logger.error("Worker error", { error: err.message });
  });

  logger.info("Inline worker running");

  return {
    shutdown: async () => {
      logger.info("Shutting down inline worker...");
      await worker.close();
    },
  };
}
