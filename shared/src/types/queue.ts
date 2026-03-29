// shared/src/types/queue.ts

export const QUEUE_NAMES = {
  EVENTS: "events",
  DEAD_LETTER: "events-dead-letter",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface EventJobData {
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
  source: string;
  enqueuedAt: string;
  // Replay metadata — present when this job is a replay
  isReplay?: boolean;
  originalEventId?: string;
}

export interface JobResult {
  success: boolean;
  processedAt: string;
  durationMs: number;
  output?: Record<string, unknown>;
  error?: string;
}
