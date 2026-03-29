// worker/src/processors/event.processor.ts
import { Job } from "bullmq";
import { PrismaClient, EventStatus } from "@prisma/client";
import { EventJobData } from "../../../shared/src/types/queue";
import { getProcessor } from "./registry";
import { createLogger } from "../../../shared/src/utils/logger";

const logger = createLogger("event-processor");

export async function processEvent(
  job: Job<EventJobData>,
  prisma: PrismaClient
): Promise<void> {
  const { eventId, type, isReplay, originalEventId } = job.data;
  const attemptNumber = (job.attemptsMade ?? 0) + 1;
  const processingStartedAt = new Date();

  logger.info("Job started", {
    jobId: job.id,
    eventId,
    type,
    attempt: attemptNumber,
    isReplay: isReplay ?? false,
  });

  // Mark PROCESSING + record when processing started
  await prisma.event.update({
    where: { id: eventId },
    data: {
      status: EventStatus.PROCESSING,
      attempts: attemptNumber,
      processingStartedAt,
    },
  });

  // Log this attempt start
  await prisma.eventLog.create({
    data: {
      eventId,
      attempt: attemptNumber,
      status: EventStatus.PROCESSING,
      message: isReplay
        ? `Replay attempt ${attemptNumber} (original: ${originalEventId})`
        : `Attempt ${attemptNumber} started`,
    },
  });

  const startMs = Date.now();

  try {
    const processor = getProcessor(type);
    const result = await processor(job.data);
    const durationMs = Date.now() - startMs;
    const now = new Date();

    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: EventStatus.SUCCESS,
        processedAt: now,
        errorMessage: null,
        errorStack: null,
      },
    });

    await prisma.eventLog.create({
      data: {
        eventId,
        attempt: attemptNumber,
        status: EventStatus.SUCCESS,
        message: `Processed successfully in ${durationMs}ms`,
        durationMs,
      },
    });

    logger.info("Job completed successfully", {
      jobId: job.id,
      eventId,
      type,
      durationMs,
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? (err.stack ?? null) : null;
    const isLastAttempt = attemptNumber >= (job.opts.attempts ?? 1);

    logger.warn("Job attempt failed", {
      jobId: job.id,
      eventId,
      type,
      attempt: attemptNumber,
      isLastAttempt,
      error: errorMessage,
    });

    // Always log the failure attempt
    await prisma.eventLog.create({
      data: {
        eventId,
        attempt: attemptNumber,
        status: isLastAttempt ? EventStatus.DEAD_LETTERED : EventStatus.FAILED,
        message: errorMessage,
        errorStack,
        durationMs,
      },
    });

    if (isLastAttempt) {
      await prisma.event.update({
        where: { id: eventId },
        data: {
          status: EventStatus.DEAD_LETTERED,
          errorMessage,
          errorStack,
          processedAt: new Date(),
        },
      });

      logger.error("Job dead-lettered after all retries exhausted", {
        jobId: job.id,
        eventId,
        type,
        attempts: attemptNumber,
      });
    } else {
      await prisma.event.update({
        where: { id: eventId },
        data: {
          status: EventStatus.QUEUED,
          errorMessage: `Attempt ${attemptNumber} failed: ${errorMessage}`,
          errorStack,
          queuedAt: new Date(),
        },
      });
    }

    throw err;
  }
}
