// api/src/routes/events.ts
import { Router } from "express";
import { eventController } from "../controllers/event.controller";
import { authenticate } from "../middleware/auth";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.use(authenticate);
router.use(apiRateLimiter);

// Ingest
router.post("/", (req, res) => eventController.create(req as any, res));

// List + aggregate
router.get("/", (req, res) => eventController.list(req, res));
router.get("/metrics", (req, res) => eventController.getMetrics(req, res));
router.get("/charts", (req, res) => eventController.getChartData(req, res));

// Single event
router.get("/:id", (req, res) => eventController.getById(req, res));
router.get("/:id/timeline", (req, res) => eventController.getTimeline(req, res));
router.get("/:id/replays", (req, res) => eventController.getReplayChain(req, res));

// Actions
router.post("/:id/retry", (req, res) => eventController.retry(req, res));
router.post("/:id/replay", (req, res) => eventController.replay(req as any, res));

export default router;
