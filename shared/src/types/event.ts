// shared/src/types/event.ts

export type EventStatus =
  | "QUEUED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "DEAD_LETTERED";

export interface EventRecord {
  id: string;
  type: string;
  source: string;
  payload: Record<string, unknown>;
  status: EventStatus;
  apiKeyId?: string | null;
  attempts: number;
  jobId?: string | null;
  // Lifecycle timestamps
  queuedAt?: Date | null;
  processingStartedAt?: Date | null;
  processedAt?: Date | null;
  // Errors
  errorMessage?: string | null;
  errorStack?: string | null;
  // Replay
  replayOf?: string | null;
  replayCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventLog {
  id: string;
  eventId: string;
  attempt: number;
  status: EventStatus;
  message?: string | null;
  errorStack?: string | null;
  durationMs?: number | null;
  createdAt: Date;
}

export interface EventWithLogs extends EventRecord {
  logs: EventLog[];
}

export interface TimelineStep {
  label: string;
  timestamp: Date | null;
  durationMs?: number | null; // ms since previous step
  status: "done" | "active" | "pending" | "error";
}

export interface CreateEventDTO {
  type: string;
  payload: Record<string, unknown>;
  source?: string;
}

export interface EventListResponse {
  data: EventRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MetricsResponse {
  total: number;
  queued: number;
  processing: number;
  success: number;
  failed: number;
  deadLettered: number;
  successRate: number;
}

export interface ChartDataPoint {
  timestamp: string; // ISO minute bucket
  count: number;
  failed: number;
}

export interface ChartResponse {
  points: ChartDataPoint[];
  windowMinutes: number;
}
