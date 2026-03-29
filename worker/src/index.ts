// worker/src/index.ts
import { Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { config } from "./config";
import { processEvent } from "./processors/event.processor";
import { EventJobData } from "../../shared/src/types/queue";
import { createLogger } from "../../shared/src/utils/logger";

const logger = createLogger("worker");

async function bootstrap() {
  logger.info("Starting EventFlow Worker", {
    concurrency: config.worker.concurrency,
    queue: config.queue.name,
  });

  // Shared Redis connection (maxRetriesPerRequest: null required for BullMQ)
  const connection = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  connection.on("connect", () => logger.info("Redis connected"));
  connection.on("error", (err) => logger.error("Redis error", { error: String(err) }));

  // Prisma client
  const prisma = new PrismaClient();
  await prisma.$connect();
  logger.info("Database connected");

  // BullMQ Worker
  const worker = new Worker<EventJobData>(
    config.queue.name,
    async (job) => {
      await processEvent(job, prisma);
    },
    {
      connection,
      concurrency: config.worker.concurrency,
      stalledInterval: config.worker.stalledInterval,
      maxStalledCount: config.worker.maxStalledCount,
    }
  );

  // Worker lifecycle events
  worker.on("completed", (job) => {
    logger.info("Worker: job completed", { jobId: job.id, name: job.name });
  });

  worker.on("failed", (job, err) => {
    logger.warn("Worker: job failed", {
      jobId: job?.id,
      name: job?.name,
      attempts: job?.attemptsMade,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    logger.error("Worker error", { error: err.message });
  });

  worker.on("stalled", (jobId) => {
    logger.warn("Worker: job stalled", { jobId });
  });

  // Queue events — useful for monitoring
  const queueEvents = new QueueEvents(config.queue.name, { connection });

  queueEvents.on("waiting", ({ jobId }) => {
    logger.debug("Job waiting", { jobId });
  });

  queueEvents.on("active", ({ jobId }) => {
    logger.debug("Job active", { jobId });
  });

  logger.info("Worker is running and waiting for jobs...");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down worker gracefully`);

    await worker.close();
    await queueEvents.close();
    await connection.quit();
    await prisma.$disconnect();

    logger.info("Worker shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { error: err.message, stack: err.stack });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason: String(reason) });
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start worker:", err);
  process.exit(1);
});
