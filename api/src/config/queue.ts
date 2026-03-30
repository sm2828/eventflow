// api/src/config/queue.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./index";
import { createLogger } from "../../../shared/src/utils/logger";
import { QUEUE_NAMES, EventJobData } from "../../../shared/src/types/queue";

const logger = createLogger("queue");

// Upstash (and other TLS Redis providers) use rediss:// URLs.
// IORedis needs explicit tls:{} options when connecting over TLS,
// otherwise it connects, immediately gets a TLS error, and closes.
function buildConnectionOptions(url: string): ConstructorParameters<typeof IORedis>[1] {
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

function buildClientOptions(url: string): ConstructorParameters<typeof IORedis>[1] {
  const isTLS = url.startsWith("rediss://");
  return {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    ...(isTLS && {
      tls: {
        rejectUnauthorized: true,
      },
    }),
  };
}

// BullMQ manages this connection — do NOT call .connect() on it manually.
export const redisConnection = new IORedis(
  config.redis.url,
  buildConnectionOptions(config.redis.url)
);

// Separate client for health checks — we manage this one ourselves.
export const redisClient = new IORedis(
  config.redis.url,
  buildClientOptions(config.redis.url)
);

redisConnection.on("connect", () => logger.info("Redis (queue) connected"));
redisConnection.on("error", (err) =>
  logger.error("Redis (queue) error", { error: String(err) })
);
redisClient.on("connect", () => logger.info("Redis (client) connected"));
redisClient.on("error", (err) =>
  logger.error("Redis (client) error", { error: String(err) })
);

export const eventQueue = new Queue<EventJobData>(QUEUE_NAMES.EVENTS, {
  connection: redisConnection,
  defaultJobOptions: config.queue.defaultJobOptions,
});

export const deadLetterQueue = new Queue<EventJobData>(QUEUE_NAMES.DEAD_LETTER, {
  connection: redisConnection,
});

export async function connectQueue(): Promise<void> {
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
