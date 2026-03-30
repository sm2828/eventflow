// api/src/config/queue.ts
import { Queue } from "bullmq";
import IORedis, { type RedisOptions } from "ioredis";
import { config } from "./index";
import { createLogger } from "../../../shared/src/utils/logger";
import { QUEUE_NAMES, EventJobData } from "../../../shared/src/types/queue";

const logger = createLogger("queue");

// Upstash (and other TLS Redis providers) use rediss:// URLs.
// IORedis needs explicit tls:{} options when connecting over TLS,
// otherwise it connects, immediately gets a TLS error, and closes.
function buildConnectionOptions(url: string): RedisOptions {
  const isTLS = url.startsWith("rediss://");
  return {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,    // Required by BullMQ
    lazyConnect: true,
    ...(isTLS && {
      tls: {
        // Upstash certs are valid — rejectUnauthorized:true is safe and correct
        rejectUnauthorized: true,
      },
    }),
  };
}

// Single shared IORedis for BullMQ + /health (two clients to the same URL
// caused connect/EPIPE/Connection is closed flapping on managed Redis e.g. Upstash).
export const redisConnection = new IORedis(
  config.redis.url,
  buildConnectionOptions(config.redis.url)
);

redisConnection.on("connect", () => logger.info("Redis connected"));
redisConnection.on("error", (err) =>
  logger.error("Redis error", { error: String(err) })
);

/** Same instance as redisConnection (health route import). */
export const redisClient = redisConnection;

export const eventQueue = new Queue<EventJobData>(QUEUE_NAMES.EVENTS, {
  connection: redisConnection,
  defaultJobOptions: config.queue.defaultJobOptions,
});

export const deadLetterQueue = new Queue<EventJobData>(QUEUE_NAMES.DEAD_LETTER, {
  connection: redisConnection,
});

export async function connectQueue(): Promise<void> {
  await redisConnection.ping();
  logger.info("Queue system ready", {
    queue: QUEUE_NAMES.EVENTS,
    deadLetter: QUEUE_NAMES.DEAD_LETTER,
  });
}

export async function disconnectQueue(): Promise<void> {
  await eventQueue.close();
  await deadLetterQueue.close();
  await redisConnection.quit();
}
