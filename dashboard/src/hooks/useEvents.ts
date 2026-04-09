// dashboard/src/hooks/useEvents.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { api, Event, EventListResponse, Metrics, ChartData } from "../lib/api";

const POLL_INTERVAL_MS = 1000;

interface UseEventsState {
  events: Event[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

interface UseEventsOptions {
  status?: string;
  type?: string;
  pageSize?: number;
  autoRefresh?: boolean;
}

export function useEvents(opts: UseEventsOptions = {}) {
  const [state, setState] = useState<UseEventsState>({
    events: [],
    total: 0,
    page: 1,
    pageSize: opts.pageSize ?? 20,
    loading: true,
    error: null,
  });

  const currentPageRef = useRef(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPage = useCallback(
    async (page: number) => {
      try {
        const res: EventListResponse = await api.events.list({
          page,
          pageSize: opts.pageSize ?? 20,
          status: opts.status,
          type: opts.type,
        });
        currentPageRef.current = res.page;
        setState((s) => ({
          ...s,
          events: res.data,
          total: res.total,
          page: res.page,
          pageSize: res.pageSize,
          loading: false,
          error: null,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load events",
        }));
      }
    },
    [opts.status, opts.type, opts.pageSize]
  );

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    currentPageRef.current = 1;
    fetchPage(1);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    if (opts.autoRefresh) {
      intervalRef.current = setInterval(
        () => fetchPage(currentPageRef.current),
        POLL_INTERVAL_MS
      );
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [opts.status, opts.type, opts.autoRefresh, fetchPage]);

  const goToPage = (page: number) => fetchPage(page);

  const retry = async (id: string) => {
    await api.events.retry(id);
    fetchPage(currentPageRef.current);
  };

  const replay = async (id: string) => {
    const result = await api.events.replay(id);
    fetchPage(currentPageRef.current);
    return result;
  };

  return {
    ...state,
    goToPage,
    retry,
    replay,
    refresh: () => fetchPage(currentPageRef.current),
  };
}

export function useMetrics(autoRefresh = true) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await api.events.metrics();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    if (!autoRefresh) return;
    const interval = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return { metrics, loading, error, refresh: fetchMetrics };
}

export function useCharts(windowMinutes: number, autoRefresh = true) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const d = await api.events.charts(windowMinutes);
      setData(d);
    } catch {
      // silently fail — charts are non-critical
    } finally {
      setLoading(false);
    }
  }, [windowMinutes]);

  useEffect(() => {
    setLoading(true);
    fetch();
    if (!autoRefresh) return;
    const interval = setInterval(fetch, 30_000); // charts refresh every 30s
    return () => clearInterval(interval);
  }, [fetch, autoRefresh]);

  return { data, loading, refresh: fetch };
}
