// api/src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import { config } from "../config";
import { AuthenticatedRequest } from "./auth";

// Per-API-key rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by API key so limits are per-consumer, not per-IP
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.apiKey ?? req.ip ?? "unknown";
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Max ${config.rateLimit.max} requests per ${config.rateLimit.windowMs / 1000}s.`,
    });
  },
});
