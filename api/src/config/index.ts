// api/src/config/index.ts

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),

  database: {
    url: requireEnv("DATABASE_URL"),
  },

  redis: {
    url: requireEnv("REDIS_URL"),
  },

  auth: {
    // Comma-separated list of valid API keys
    apiKeys: new Set(
      (process.env.API_KEYS || "dev_key_123").split(",").map((k) => k.trim())
    ),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  },

  queue: {
    name: "events",
    deadLetterName: "events-dead-letter",
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential" as const,
        delay: 1000, // 1s, 2s, 4s
      },
      removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
      removeOnFail: { count: 500 },      // Keep last 500 failed jobs
    },
  },
} as const;
