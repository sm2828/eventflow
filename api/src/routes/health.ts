// api/src/routes/health.ts
import { Router } from "express";
import { prisma } from "../config/database";
import { redisClient } from "../config/queue";

const router = Router();

const HEALTH_CACHE_MS = parseInt(process.env.HEALTH_CACHE_MS || "30000", 10);
let cached:
  | {
      at: number;
      statusCode: number;
      body: {
        status: "ok" | "degraded";
        timestamp: string;
        checks: { database: "ok" | "error"; redis: "ok" | "error" };
      };
    }
  | null = null;

router.get("/health", async (_req, res) => {
  if (
    cached &&
    cached.body.status === "ok" &&
    Date.now() - cached.at < HEALTH_CACHE_MS
  ) {
    return res.status(cached.statusCode).json(cached.body);
  }

  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redisClient.ping(),
  ]);

  const db = checks[0].status === "fulfilled" ? "ok" : "error";
  const redis = checks[1].status === "fulfilled" ? "ok" : "error";
  const healthy = db === "ok" && redis === "ok";

  const body = {
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks: { database: db, redis },
  } as const;

  cached = {
    at: Date.now(),
    statusCode: healthy ? 200 : 503,
    body,
  };

  return res.status(cached.statusCode).json(cached.body);
});

export default router;
