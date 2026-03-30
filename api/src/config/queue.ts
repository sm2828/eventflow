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
    enableReadyCheck: false, // Required by BullMQ; avoids extra INFO round-trips on managed Redis
    // Eager connect: lazyConnect + two Queue()s both call waitUntilReady() on the same
    // client during import and can race (connect before ready, then close → "Connection is closed").
    lazyConnect: false,
    // Prefer IPv4 from cloud hosts (Render ↔ Upstash) when DNS returns AAAA first.
    ...(isTLS ? { family: 4 as const } : {}),
    ...(isTLS && {
      tls: {
        rejectUnauthorized: true,
      },
    }),
  };
}

export const redisConnection = new IORedis(
  config.redis.url,
  buildConnectionOptions(config.redis.url)
);

redisConnection.on("connect", () => logger.info("Redis connect (TCP)"));
redisConnection.on("ready", () => logger.info("Redis ready (handshake complete)"));
redisConnection.on("error", (err) =>
  logger.error("Redis error", { error: String(err) })
);

/** Same instance as redisConnection — health route import. */
export const redisClient = redisConnection;

/** Filled in connectQueue() so BullMQ never runs init/waitUntilReady during module import. */
export let eventQueue!: Queue<EventJobData>;
export let deadLetterQueue!: Queue<EventJobData>;

let queuesCreated = false;

export async function connectQueue(): Promise<void> {
  await redisConnection.ping();
  eventQueue = new Queue<EventJobData>(QUEUE_NAMES.EVENTS, {
    connection: redisConnection,
    defaultJobOptions: config.queue.defaultJobOptions,
  });
  deadLetterQueue = new Queue<EventJobData>(QUEUE_NAMES.DEAD_LETTER, {
    connection: redisConnection,
  });
  queuesCreated = true;
  logger.info("Queue system ready", {
    queue: QUEUE_NAMES.EVENTS,
    deadLetter: QUEUE_NAMES.DEAD_LETTER,
  });
}

export async function disconnectQueue(): Promise<void> {
  if (queuesCreated) {
    await eventQueue.close();
    await deadLetterQueue.close();
    queuesCreated = false;
  }
  await redisConnection.quit();
}
