// worker/src/config/index.ts

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  env: process.env.NODE_ENV || "development",

  database: {
    url: requireEnv("DATABASE_URL"),
  },

  redis: {
    url: requireEnv("REDIS_URL"),
  },

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5", 10),
    // Max stalled job check interval (ms)
    stalledInterval: 30_000,
    // Considered stalled if no heartbeat for this long (ms)
    maxStalledCount: 1,
  },

  queue: {
    name: "events",
    deadLetterName: "events-dead-letter",
  },
} as const;
