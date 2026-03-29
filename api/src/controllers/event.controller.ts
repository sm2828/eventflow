// api/src/controllers/event.controller.ts
import { Request, Response } from "express";
import { z } from "zod";
import { eventService } from "../services/event.service";
import { AuthenticatedRequest } from "../middleware/auth";
import { createLogger } from "../../../shared/src/utils/logger";

const logger = createLogger("event-controller");

const CreateEventSchema = z.object({
  type: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9._:-]+$/, "Event type must be alphanumeric with . _ : - allowed"),
  payload: z.record(z.unknown()).default({}),
  source: z.string().max(64).optional(),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(["QUEUED", "PROCESSING", "SUCCESS", "FAILED", "DEAD_LETTERED"]).optional(),
  type: z.string().optional(),
});

export class EventController {
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const body = CreateEventSchema.parse(req.body);
    const result = await eventService.create(body, req.apiKey);
    logger.info("POST /events", { eventId: result.id, type: body.type });
    res.status(202).json({
      id: result.id,
      jobId: result.jobId,
      status: "QUEUED",
      message: "Event accepted and queued for processing.",
    });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const event = await eventService.getById(req.params.id);
    res.json(event);
  }

  async list(req: Request, res: Response): Promise<void> {
    const query = ListQuerySchema.parse(req.query);
    const result = await eventService.list(query);
    res.json(result);
  }

  async getMetrics(_req: Request, res: Response): Promise<void> {
    const metrics = await eventService.getMetrics();
    res.json(metrics);
  }

  async getChartData(req: Request, res: Response): Promise<void> {
    const window = Math.min(
      1440,
      Math.max(5, parseInt((req.query.window as string) || "60", 10))
    );
    const data = await eventService.getChartData(window);
    res.json(data);
  }

  async retry(req: Request, res: Response): Promise<void> {
    const result = await eventService.retry(req.params.id);
    res.json({ message: "Event queued for retry.", jobId: result.jobId });
  }

  async replay(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await eventService.replay(req.params.id, req.apiKey);
    res.status(202).json({
      id: result.id,
      jobId: result.jobId,
      status: "QUEUED",
      message: "Replay event created and queued.",
    });
  }

  async getTimeline(req: Request, res: Response): Promise<void> {
    const data = await eventService.getTimeline(req.params.id);
    res.json(data);
  }

  async getReplayChain(req: Request, res: Response): Promise<void> {
    const data = await eventService.getReplayChain(req.params.id);
    res.json(data);
  }
}

export const eventController = new EventController();
