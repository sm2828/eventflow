// api/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { createLogger } from "../../../shared/src/utils/logger";

const logger = createLogger("auth");

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const queryKey = req.query.api_key as string | undefined;

  // Support both: Authorization: Bearer <key> and ?api_key=<key>
  let apiKey: string | undefined;

  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      apiKey = parts[1];
    } else {
      // Also accept raw key in Authorization header (no Bearer prefix)
      apiKey = authHeader;
    }
  } else if (queryKey) {
    apiKey = queryKey;
  }

  if (!apiKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "API key required. Provide via Authorization: Bearer <key> header.",
    });
    return;
  }

  if (!config.auth.apiKeys.has(apiKey)) {
    logger.warn("Invalid API key attempt", {
      ip: req.ip,
      key: apiKey.substring(0, 6) + "...",
    });
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key.",
    });
    return;
  }

  req.apiKey = apiKey;
  next();
}
