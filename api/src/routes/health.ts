// api/src/routes/health.ts
import { Router } from "express";
import { prisma } from "../config/database";
import { redisClient } from "../config/queue";

const router = Router();

router.get("/health", async (_req, res) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redisClient.ping(),
  ]);

  const db = checks[0].status === "fulfilled" ? "ok" : "error";
  const redis = checks[1].status === "fulfilled" ? "ok" : "error";
  const healthy = db === "ok" && redis === "ok";

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks: { database: db, redis },
  });
});

export default router;
