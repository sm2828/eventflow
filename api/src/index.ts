// api/src/index.ts
import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { PrismaClient } from "@prisma/client";
import { config } from "./config";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { connectQueue, disconnectQueue } from "./config/queue";
import eventsRouter from "./routes/events";
import healthRouter from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger } from "../../shared/src/utils/logger";

const logger = createLogger("api");

// INLINE_WORKER=true  → run the BullMQ worker inside this process (Render free tier)
// INLINE_WORKER=false → API only, worker runs as a separate service (local Docker Compose)
const RUN_INLINE_WORKER = process.env.INLINE_WORKER === "true";

async function bootstrap() {
  await connectDatabase();
  await connectQueue();

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
        : "*",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use((req, _res, next) => {
    logger.debug("Incoming request", { method: req.method, path: req.path, ip: req.ip });
    next();
  });

  app.use("/", healthRouter);
  app.use("/events", eventsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found", message: "Route does not exist." });
  });

  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    logger.info("API server started", { port: config.port, env: config.env });
  });

  // Start inline worker if configured (Render free tier)
  let workerShutdown: (() => Promise<void>) | null = null;
  if (RUN_INLINE_WORKER) {
    // Lazy import so Docker Compose deployments never load worker code
    const { startInlineWorker } = await import("./worker");
    const prisma = new PrismaClient();
    await prisma.$connect();
    const w = await startInlineWorker(prisma);
    workerShutdown = w.shutdown;
    logger.info("Inline worker started alongside API");
  }

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);

    if (workerShutdown) {
      await workerShutdown();
    }

    server.close(async () => {
      await disconnectDatabase();
      await disconnectQueue();
      logger.info("Shutdown complete");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { error: err.message, stack: err.stack });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason: String(reason) });
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
