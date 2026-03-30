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
    enableReadyCheck: false, // Required by BullMQ
    // Connect only from connectQueue() after DB — avoids overlapping with Prisma startup
    // and matches most managed-Redis docs (single client, on-demand connect).
    lazyConnect: true,
    connectTimeout: 20_000,
    // No commandTimeout: on flaky reconnects it aborts PING mid-handshake and surfaces as
    // "Command timed out" (ioredis Command.js) instead of completing or our outer deadline firing.
    // Stop endless reconnect storms (bad REDIS_URL wastes deploy health checks).
    retryStrategy(times: number) {
      if (times > 30) return null;
      return Math.min(times * 250, 4_000);
    },
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

const REDIS_READY_DEADLINE_MS = 45_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${ms}ms — check REDIS_URL is the TLS Redis URL (rediss://… from Upstash "Redis" tab, not REST).`
        )
      );
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function connectQueue(): Promise<void> {
  // connect() waits until ioredis is "ready" (TLS + AUTH + handshake), unlike bare ping under churn.
  await withTimeout(redisConnection.connect(), REDIS_READY_DEADLINE_MS, "Redis connect");
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
