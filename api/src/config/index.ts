// api/src/config/index.ts

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const config = {
  env: process.env.NODE_ENV || "development",

  port: parseInt(process.env.PORT || "3000", 10),

  redis: {
    url: requireEnv("REDIS_URL"),
  },

  auth: {
    apiKeys: new Set(parseCsv(process.env.API_KEYS || "")),
  },

  queue: {
    defaultJobOptions: {
      removeOnComplete: 500,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    },
  },
} as const;