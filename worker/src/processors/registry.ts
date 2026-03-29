// worker/src/processors/registry.ts
import { EventJobData, JobResult } from "../../../shared/src/types/queue";
import { createLogger } from "../../../shared/src/utils/logger";

const logger = createLogger("processor-registry");

type ProcessorFn = (job: EventJobData) => Promise<JobResult>;

// Built-in processor: generic fallback
const genericProcessor: ProcessorFn = async (job) => {
  const start = Date.now();

  logger.info("Processing generic event", {
    eventId: job.eventId,
    type: job.type,
  });

  // Simulate async work (e.g., calling a downstream service)
  await new Promise((r) => setTimeout(r, Math.random() * 200 + 50));

  return {
    success: true,
    processedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    output: {
      handled: true,
      payloadKeys: Object.keys(job.payload),
    },
  };
};

// Type-specific processors
const userSignupProcessor: ProcessorFn = async (job) => {
  const start = Date.now();
  const { email, userId } = job.payload as Record<string, string>;

  logger.info("Processing user.signup event", { eventId: job.eventId, userId });

  // Simulate: send welcome email, create user profile, etc.
  await new Promise((r) => setTimeout(r, 150));

  if (!email) {
    throw new Error("user.signup event missing required field: email");
  }

  return {
    success: true,
    processedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    output: {
      welcomeEmailQueued: true,
      userId,
    },
  };
};

const orderCreatedProcessor: ProcessorFn = async (job) => {
  const start = Date.now();
  const { orderId, amount } = job.payload as Record<string, unknown>;

  logger.info("Processing order.created event", { eventId: job.eventId, orderId });

  // Simulate: update inventory, trigger fulfillment, etc.
  await new Promise((r) => setTimeout(r, 300));

  return {
    success: true,
    processedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    output: {
      inventoryUpdated: true,
      fulfillmentTriggered: true,
      orderId,
      amount,
    },
  };
};

const paymentProcessedProcessor: ProcessorFn = async (job) => {
  const start = Date.now();
  const { transactionId, status } = job.payload as Record<string, unknown>;

  logger.info("Processing payment.processed event", {
    eventId: job.eventId,
    transactionId,
    status,
  });

  // Simulate: update billing records, notify user, etc.
  await new Promise((r) => setTimeout(r, 100));

  // Simulate occasional processing failure for demo purposes (~5% chance)
  if (Math.random() < 0.05) {
    throw new Error("Payment gateway timeout — will retry");
  }

  return {
    success: true,
    processedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    output: {
      recorded: true,
      transactionId,
    },
  };
};

// ---- Registry ----

const PROCESSORS: Record<string, ProcessorFn> = {
  "user.signup": userSignupProcessor,
  "order.created": orderCreatedProcessor,
  "payment.processed": paymentProcessedProcessor,
};

export function getProcessor(eventType: string): ProcessorFn {
  const processor = PROCESSORS[eventType];
  if (!processor) {
    logger.debug("No specific processor for type, using generic", { eventType });
    return genericProcessor;
  }
  return processor;
}
