// api/src/services/event.service.ts
import { EventStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { eventQueue } from "../config/queue";
import {
  CreateEventDTO,
  EventListResponse,
  MetricsResponse,
  ChartResponse,
} from "../../../shared/src/types/event";
import { EventJobData } from "../../../shared/src/types/queue";
import { createLogger } from "../../../shared/src/utils/logger";
import { AppError } from "../middleware/errorHandler";

const logger = createLogger("event-service");
const MAX_PAYLOAD_SIZE_BYTES = 512 * 1024;

export class EventService {
  // ── Create ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateEventDTO,
    apiKey?: string
  ): Promise<{ id: string; jobId: string }> {
    const payloadStr = JSON.stringify(dto.payload);
    if (Buffer.byteLength(payloadStr, "utf8") > MAX_PAYLOAD_SIZE_BYTES) {
      throw new AppError(413, "Payload too large. Maximum size is 512KB.", "PAYLOAD_TOO_LARGE");
    }

    const now = new Date();
    const event = await prisma.event.create({
      data: {
        type: dto.type,
        source: dto.source ?? "api",
        payload: dto.payload as Prisma.InputJsonValue,
        status: EventStatus.QUEUED,
        apiKeyId: apiKey,
        queuedAt: now,
      },
    });

    const jobData: EventJobData = {
      eventId: event.id,
      type: event.type,
      payload: dto.payload,
      source: event.source,
      enqueuedAt: now.toISOString(),
    };

    const job = await eventQueue.add(`process:${event.type}`, jobData, {
      jobId: event.id,
    });

    await prisma.event.update({
      where: { id: event.id },
      data: { jobId: job.id },
    });

    logger.info("Event created and queued", { eventId: event.id, type: event.type });
    return { id: event.id, jobId: job.id! };
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  async getById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { logs: { orderBy: { createdAt: "asc" } } },
    });
    if (!event) throw new AppError(404, `Event not found: ${id}`, "EVENT_NOT_FOUND");
    return event;
  }

  async list(opts: {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
  }): Promise<EventListResponse> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(opts.status ? { status: opts.status as EventStatus } : {}),
      ...(opts.type ? { type: opts.type } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip,
      }),
      prisma.event.count({ where }),
    ]);

    return { data: data as any, total, page, pageSize };
  }

  async getMetrics(): Promise<MetricsResponse> {
    const counts = await prisma.event.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {};
    let total = 0;
    for (const row of counts) {
      statusMap[row.status] = row._count.id;
      total += row._count.id;
    }

    const success = statusMap[EventStatus.SUCCESS] ?? 0;
    const failed = statusMap[EventStatus.FAILED] ?? 0;
    const finished = success + failed;

    return {
      total,
      queued: statusMap[EventStatus.QUEUED] ?? 0,
      processing: statusMap[EventStatus.PROCESSING] ?? 0,
      success,
      failed,
      deadLettered: statusMap[EventStatus.DEAD_LETTERED] ?? 0,
      successRate: finished > 0 ? Math.round((success / finished) * 100) : 0,
    };
  }

  // ── Charts: events per minute + failure rate over last N minutes ──────────

  async getChartData(windowMinutes = 60): Promise<ChartResponse> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const events = await prisma.event.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    // Bucket by minute
    const buckets = new Map<string, { count: number; failed: number }>();
    for (const e of events) {
      const key = e.createdAt.toISOString().slice(0, 16); // "2024-01-01T12:34"
      const bucket = buckets.get(key) ?? { count: 0, failed: 0 };
      bucket.count++;
      if (e.status === EventStatus.FAILED || e.status === EventStatus.DEAD_LETTERED) {
        bucket.failed++;
      }
      buckets.set(key, bucket);
    }

    const points = Array.from(buckets.entries())
      .map(([timestamp, b]) => ({ timestamp, ...b }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return { points, windowMinutes };
  }

  // ── Retry (re-queue failed/dead-lettered, same event record) ─────────────

  async retry(id: string): Promise<{ jobId: string }> {
    const event = await this.getById(id);

    if (event.status !== EventStatus.FAILED && event.status !== EventStatus.DEAD_LETTERED) {
      throw new AppError(
        400,
        `Cannot retry event with status: ${event.status}`,
        "INVALID_STATUS_FOR_RETRY"
      );
    }

    const now = new Date();
    await prisma.event.update({
      where: { id },
      data: {
        status: EventStatus.QUEUED,
        errorMessage: null,
        errorStack: null,
        queuedAt: now,
      },
    });

    const jobData: EventJobData = {
      eventId: event.id,
      type: event.type,
      payload: event.payload as Record<string, unknown>,
      source: event.source,
      enqueuedAt: now.toISOString(),
    };

    const job = await eventQueue.add(`retry:${event.type}`, jobData);
    logger.info("Event manually retried", { eventId: id, jobId: job.id });
    return { jobId: job.id! };
  }

  // ── Replay (creates a NEW event record linked to the original) ────────────

  async replay(id: string, apiKey?: string): Promise<{ id: string; jobId: string }> {
    const original = await this.getById(id);

    const now = new Date();
    // Increment replay count on the original
    await prisma.event.update({
      where: { id },
      data: { replayCount: { increment: 1 } },
    });

    // Create a brand-new event record that references the original
    const replayEvent = await prisma.event.create({
      data: {
        type: original.type,
        source: "replay",
        payload: original.payload as Prisma.InputJsonValue,
        status: EventStatus.QUEUED,
        apiKeyId: apiKey,
        replayOf: original.id,
        queuedAt: now,
      },
    });

    const jobData: EventJobData = {
      eventId: replayEvent.id,
      type: replayEvent.type,
      payload: original.payload as Record<string, unknown>,
      source: "replay",
      enqueuedAt: now.toISOString(),
      isReplay: true,
      originalEventId: original.id,
    };

    const job = await eventQueue.add(`replay:${replayEvent.type}`, jobData);

    await prisma.event.update({
      where: { id: replayEvent.id },
      data: { jobId: job.id },
    });

    logger.info("Event replayed", {
      originalId: id,
      replayId: replayEvent.id,
      jobId: job.id,
    });

    return { id: replayEvent.id, jobId: job.id! };
  }

  // ── Timeline for a single event ────────────────────────────────────────────

  async getTimeline(id: string) {
    const event = await this.getById(id);

    type StepStatus = "done" | "active" | "pending" | "error";
    const steps: Array<{
      label: string;
      timestamp: Date | null;
      durationMs: number | null;
      status: StepStatus;
    }> = [
      {
        label: "Created",
        timestamp: event.createdAt,
        durationMs: null,
        status: "done",
      },
      {
        label: "Queued",
        timestamp: event.queuedAt ?? event.createdAt,
        durationMs: event.queuedAt
          ? event.queuedAt.getTime() - event.createdAt.getTime()
          : null,
        status: "done",
      },
    ];

    if (event.processingStartedAt) {
      const prev = (event.queuedAt ?? event.createdAt).getTime();
      steps.push({
        label: "Processing Started",
        timestamp: event.processingStartedAt,
        durationMs: event.processingStartedAt.getTime() - prev,
        status: event.status === EventStatus.PROCESSING ? "active" : "done",
      });
    }

    if (event.processedAt) {
      const prev = (event.processingStartedAt ?? event.queuedAt ?? event.createdAt).getTime();
      const isError =
        event.status === EventStatus.FAILED ||
        event.status === EventStatus.DEAD_LETTERED;
      steps.push({
        label: isError ? "Failed" : "Completed",
        timestamp: event.processedAt,
        durationMs: event.processedAt.getTime() - prev,
        status: isError ? "error" : "done",
      });
    } else if (
      event.status === EventStatus.FAILED ||
      event.status === EventStatus.DEAD_LETTERED
    ) {
      steps.push({
        label: event.status === EventStatus.DEAD_LETTERED ? "Dead Lettered" : "Failed",
        timestamp: event.updatedAt,
        durationMs: null,
        status: "error",
      });
    }

    return {
      event,
      steps,
      totalDurationMs:
        event.processedAt
          ? event.processedAt.getTime() - event.createdAt.getTime()
          : null,
    };
  }

  // ── Replay history: all replays of a given event ──────────────────────────

  async getReplayChain(id: string) {
    const [original, replays] = await Promise.all([
      prisma.event.findUnique({ where: { id } }),
      prisma.event.findMany({
        where: { replayOf: id },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { original, replays };
  }
}

export const eventService = new EventService();
