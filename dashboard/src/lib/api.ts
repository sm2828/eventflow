// dashboard/src/lib/api.ts
// In dev: VITE_API_URL is empty, Vite proxy handles /api/* -> localhost:3000
// In prod: VITE_API_URL = "https://your-api.onrender.com" (no trailing slash)
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const API_KEY  = import.meta.env.VITE_API_KEY  || "dev_key_123";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // path is always like "/api/events" — strip /api prefix when calling a remote API_BASE
  const url = API_BASE
    ? `${API_BASE}${path.replace(/^\/api/, "")}`
    : path; // dev: Vite proxy handles /api prefix
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface EventLog {
  id: string;
  eventId: string;
  attempt: number;
  status: string;
  message: string | null;
  errorStack: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface Event {
  id: string;
  type: string;
  source: string;
  payload: Record<string, unknown>;
  status: "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED" | "DEAD_LETTERED";
  attempts: number;
  jobId: string | null;
  queuedAt: string | null;
  processingStartedAt: string | null;
  processedAt: string | null;
  errorMessage: string | null;
  errorStack: string | null;
  replayOf: string | null;
  replayCount: number;
  createdAt: string;
  updatedAt: string;
  logs?: EventLog[];
}

export interface EventListResponse {
  data: Event[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Metrics {
  total: number;
  queued: number;
  processing: number;
  success: number;
  failed: number;
  deadLettered: number;
  successRate: number;
}

export interface ChartPoint {
  timestamp: string;
  count: number;
  failed: number;
}

export interface ChartData {
  points: ChartPoint[];
  windowMinutes: number;
}

export interface TimelineStep {
  label: string;
  timestamp: string | null;
  durationMs: number | null;
  status: "done" | "active" | "pending" | "error";
}

export interface TimelineData {
  event: Event;
  steps: TimelineStep[];
  totalDurationMs: number | null;
}

export interface ReplayChain {
  original: Event | null;
  replays: Event[];
}

export const api = {
  events: {
    create: (type: string, payload: Record<string, unknown>) =>
      request<{ id: string; jobId: string; status: string }>(
        `/api/events`,
        {
          method: "POST",
          body: JSON.stringify({ type, payload }),
        }
      ),
    list: (params: { page?: number; pageSize?: number; status?: string; type?: string }) => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params.status) qs.set("status", params.status);
      if (params.type) qs.set("type", params.type);
      return request<EventListResponse>(`/api/events?${qs}`);
    },
    get: (id: string) => request<Event>(`/api/events/${id}`),
    retry: (id: string) =>
      request<{ message: string; jobId: string }>(`/api/events/${id}/retry`, { method: "POST" }),
    replay: (id: string) =>
      request<{ id: string; jobId: string; status: string; message: string }>(
        `/api/events/${id}/replay`,
        { method: "POST" }
      ),
    timeline: (id: string) => request<TimelineData>(`/api/events/${id}/timeline`),
    replayChain: (id: string) => request<ReplayChain>(`/api/events/${id}/replays`),
    metrics: () => request<Metrics>("/api/events/metrics"),
    charts: (windowMinutes = 60) =>
      request<ChartData>(`/api/events/charts?window=${windowMinutes}`),
  },
  health: () =>
    request<{ status: string; checks: Record<string, string> }>("/api/health"),
};
