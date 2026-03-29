// api/src/index.ts
import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { connectQueue, disconnectQueue } from "./config/queue";
import eventsRouter from "./routes/events";
import healthRouter from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger } from "../../shared/src/utils/logger";

const logger = createLogger("api");

async function bootstrap() {
  // Connect dependencies
  await connectDatabase();
  await connectQueue();

  const app = express();

  // Security & parsing middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGINS?.split(",") ?? "*",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  // Request logging middleware
  app.use((req, _res, next) => {
    logger.debug("Incoming request", {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // Routes
  app.use("/", healthRouter);
  app.use("/events", eventsRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found", message: "Route does not exist." });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    logger.info("API server started", {
      port: config.port,
      env: config.env,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectQueue();
      logger.info("Shutdown complete");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
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
