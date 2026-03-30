// api/src/config/queue.ts
import { Queue } from "bullmq";
import IORedis, { type RedisOptions } from "ioredis";
import { config } from "./index";
import { createLogger } from "../../../shared/src/utils/logger";
import { QUEUE_NAMES, EventJobData } from "../../../shared/src/types/queue";

const logger = createLogger("queue");

// Parse a redis:// or rediss:// URL into IORedis constructor options.
// We parse manually (host/port/auth) instead of passing the raw URL string
// because some ioredis versions mishandle rediss:// URL auth on TLS connections.
function parseRedisUrl(urlStr: string): RedisOptions {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error(`REDIS_URL is not a valid URL: ${urlStr}`);
  }

  const isTLS = u.protocol === "rediss:";

  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : isTLS ? 6380 : 6379,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    // Do NOT use lazyConnect — let IORedis connect automatically on construction.
    // BullMQ expects the connection to already be connecting when it receives it.
    lazyConnect: false,
    // Required by BullMQ
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 30_000,
    retryStrategy(times: number) {
      if (times > 20) return null; // stop retrying after 20 attempts
      return Math.min(times * 250, 3_000);
    },
    ...(isTLS && {
      tls: {
        servername: u.hostname,
        rejectUnauthorized: true,
      },
    }),
  };
}

// One shared connection — BullMQ and health checks use this same instance.
// IORedis is safe to share; BullMQ only reads from it, never calls connect/quit.
export const redisConnection = new IORedis(parseRedisUrl(config.redis.url));

// Alias for health route — same object, different name for clarity at call sites
export const redisClient = redisConnection;

redisConnection.on("connect", () => logger.info("Redis TCP connected"));
redisConnection.on("ready",   () => logger.info("Redis ready"));
redisConnection.on("error",   (err) => logger.error("Redis error", { error: String(err) }));
redisConnection.on("close",   () => logger.warn("Redis connection closed"));
redisConnection.on("reconnecting", () => logger.info("Redis reconnecting..."));

// Create BullMQ queues immediately — they will wait internally for the
// connection to become ready before sending any commands.
export const eventQueue = new Queue<EventJobData>(QUEUE_NAMES.EVENTS, {
  connection: redisConnection,
  defaultJobOptions: config.queue.defaultJobOptions,
});

export const deadLetterQueue = new Queue<EventJobData>(QUEUE_NAMES.DEAD_LETTER, {
  connection: redisConnection,
});

// Wait for Redis to be genuinely ready before the API starts accepting traffic.
// Times out after 30s with a helpful message if the URL is wrong.
export async function connectQueue(): Promise<void> {
  if (redisConnection.status === "ready") {
    logger.info("Redis already ready");
  } else {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "Redis did not become ready within 30s. " +
            "Check that REDIS_URL starts with rediss:// (not redis://) " +
            "and that you copied the ioredis/CLI URL from Upstash, not the REST URL."
          )
        );
      }, 30_000);

      redisConnection.once("ready", () => {
        clearTimeout(timeout);
        resolve();
      });

      redisConnection.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  // Confirm the connection actually works end-to-end
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
