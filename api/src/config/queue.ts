// api/src/config/queue.ts
import { Queue } from "bullmq";
import IORedis, { type RedisOptions } from "ioredis";
import { URL } from "url";
import { config } from "./index";
import { createLogger } from "../../../shared/src/utils/logger";
import { QUEUE_NAMES, EventJobData } from "../../../shared/src/types/queue";

const logger = createLogger("queue");

function redisOptionsFromEnvUrl(urlStr: string): RedisOptions {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error("REDIS_URL is not a valid URL");
  }
  const isTls = u.protocol === "rediss:";
  if (!isTls && u.protocol !== "redis:") {
    throw new Error('REDIS_URL must use redis:// or rediss:// (Upstash needs rediss://)');
  }
  const port = u.port ? parseInt(u.port, 10) : 6379;
  const username = u.username ? decodeURIComponent(u.username) : undefined;
  const password = u.password ? decodeURIComponent(u.password) : undefined;

  return {
    host: u.hostname,
    port,
    username: username || undefined,
    password: password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 25_000,
    lazyConnect: true,
    retryStrategy(times: number) {
      if (times > 25) return null;
      return Math.min(times * 300, 5_000);
    },
    ...(isTls && {
      tls: {
        servername: u.hostname,
        rejectUnauthorized: true,
      },
    }),
  };
}

export const redisConnection = new IORedis(redisOptionsFromEnvUrl(config.redis.url));

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
