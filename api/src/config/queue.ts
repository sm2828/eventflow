// api/src/config/queue.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./index";
import { createLogger } from "../../../shared/src/utils/logger";
import { QUEUE_NAMES, EventJobData } from "../../../shared/src/types/queue";

const logger = createLogger("queue");

// BullMQ manages this connection internally — do NOT call .connect() on it manually.
// lazyConnect:true prevents it auto-connecting before BullMQ is ready.
export const redisConnection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,    // Required by BullMQ
  lazyConnect: true,
});

// Separate lightweight client for health checks — we manage this one ourselves.
export const redisClient = new IORedis(config.redis.url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,          // We call .connect() explicitly in connectQueue()
});

redisConnection.on("connect", () => logger.info("Redis (queue) connected"));
redisConnection.on("error", (err) =>
  logger.error("Redis (queue) error", { error: String(err) })
);
redisClient.on("connect", () => logger.info("Redis (client) connected"));
redisClient.on("error", (err) =>
  logger.error("Redis (client) error", { error: String(err) })
);

// BullMQ Queue objects — BullMQ calls .connect() on redisConnection itself.
export const eventQueue = new Queue<EventJobData>(QUEUE_NAMES.EVENTS, {
  connection: redisConnection,
  defaultJobOptions: config.queue.defaultJobOptions,
});

export const deadLetterQueue = new Queue<EventJobData>(QUEUE_NAMES.DEAD_LETTER, {
  connection: redisConnection,
});

export async function connectQueue(): Promise<void> {
  // Only connect the health-check client — BullMQ handles redisConnection.
  await redisClient.connect();
  logger.info("Queue system ready", {
    queue: QUEUE_NAMES.EVENTS,
    deadLetter: QUEUE_NAMES.DEAD_LETTER,
  });
}

export async function disconnectQueue(): Promise<void> {
  await eventQueue.close();
  await deadLetterQueue.close();
  await redisConnection.quit();
  await redisClient.quit();
}
