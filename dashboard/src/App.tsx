// dashboard/src/App.tsx
import React, { useState, useEffect } from "react";
import { MetricsBar } from "./components/MetricsBar";
import { EventTable } from "./components/EventTable";
import { EventDetail } from "./components/EventDetail";
import { Filters } from "./components/Filters";
import { Pagination } from "./components/Pagination";
import { ChartsBar } from "./components/ChartsBar";
import { ReplayMode } from "./components/ReplayMode";
import { useEvents, useMetrics, useCharts } from "./hooks/useEvents";
import { Event } from "./lib/api";

const globalStyles = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #0d1117; }
  ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #484f58; }
`;

type DashboardMode = "live" | "replay";

export default function App() {
  const [mode, setMode] = useState<DashboardMode>("live");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [chartWindow, setChartWindow] = useState(60);

  const { events, total, page, pageSize, loading, error, goToPage, retry, replay, refresh } =
    useEvents({
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      autoRefresh: mode === "live",
    });

  const { metrics, loading: metricsLoading } = useMetrics(mode === "live");
  const { data: chartData, loading: chartLoading } = useCharts(chartWindow);

  useEffect(() => {
    if (!loading) setLastRefreshed(new Date());
  }, [loading, events]);

  const handleRetry = async (id: string) => {
    try { await retry(id); } catch (e) { console.error("Retry failed:", e); }
  };

  const handleReplay = async (id: string) => {
    const result = await replay(id);
    return result;
  };

  if (mode === "replay") {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{ minHeight: "100vh", background: "#0f1117" }}>
          <nav style={{
            borderBottom: "1px solid #21262d", padding: "0 24px",
            height: 56, display: "flex", alignItems: "center",
            justifyContent: "space-between", background: "#0d1117",
            position: "sticky", top: 0, zIndex: 30,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Logo />
              <ModeToggle mode={mode} onChange={setMode} />
            </div>
          </nav>
          <main style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
            <ReplayMode
              events={events}
              onExit={() => setMode("live")}
            />
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div style={{ minHeight: "100vh", background: "#0f1117" }}>

        {/* Nav */}
        <nav style={{
          borderBottom: "1px solid #21262d", padding: "0 24px",
          height: 56, display: "flex", alignItems: "center",
          justifyContent: "space-between", position: "sticky",
          top: 0, background: "#0d1117", zIndex: 30,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo />
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a
              href="http://localhost:3000/health"
              target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "#8b949e", textDecoration: "none" }}
            >
              API Health ↗
            </a>
            <code style={{
              fontSize: 11, color: "#484f58",
              background: "#161b22", padding: "3px 8px", borderRadius: 4,
            }}>
              localhost:3000
            </code>
          </div>
        </nav>

        <main style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e1e4e8", marginBottom: 4 }}>
              Event Stream
            </h1>
            <p style={{ fontSize: 14, color: "#8b949e" }}>
              Real-time view of all ingested events. Auto-refreshes every 5s.
            </p>
          </div>

          {/* Metrics */}
          <MetricsBar metrics={metrics} loading={metricsLoading} />

          {/* Charts */}
          <ChartsBar
            data={chartData}
            loading={chartLoading}
            window={chartWindow}
            onWindowChange={setChartWindow}
          />

          {/* Events panel */}
          <div style={{
            background: "#0d1117", border: "1px solid #21262d",
            borderRadius: 8, overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #21262d" }}>
              <Filters
                status={statusFilter}
                type={typeFilter}
                onStatusChange={(s) => { setStatusFilter(s); goToPage(1); }}
                onTypeChange={(t) => { setTypeFilter(t); goToPage(1); }}
                onRefresh={refresh}
                lastRefreshed={lastRefreshed}
              />
            </div>

            {error && (
              <div style={{
                padding: "12px 20px",
                background: "rgba(248,81,73,0.1)",
                borderBottom: "1px solid rgba(248,81,73,0.3)",
                color: "#f85149", fontSize: 13,
              }}>
                ⚠ {error}
              </div>
            )}

            <EventTable
              events={events}
              loading={loading}
              onRetry={handleRetry}
              onSelect={setSelectedEvent}
            />

            <div style={{ padding: "0 20px" }}>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={goToPage}
              />
            </div>
          </div>

          {/* Quick start */}
          <div style={{
            marginTop: 24, padding: 16,
            background: "#161b22", border: "1px solid #30363d",
            borderRadius: 8, fontSize: 12, color: "#8b949e",
          }}>
            <strong style={{ color: "#e1e4e8" }}>Quick start: </strong>
            <code style={{
              background: "#21262d", padding: "2px 8px",
              borderRadius: 4, color: "#79c0ff", fontSize: 11,
            }}>
              {`curl -X POST http://localhost:3000/events -H "Authorization: Bearer dev_key_123" -H "Content-Type: application/json" -d '{"type":"user.signup","payload":{"email":"test@example.com"}}'`}
            </code>
          </div>
        </main>
      </div>

      <EventDetail
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onRetry={handleRetry}
        onReplay={handleReplay}
      />
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{
        width: 24, height: 24,
        background: "linear-gradient(135deg, #58a6ff, #3fb950)",
        borderRadius: 6, display: "inline-block",
      }} />
      <span style={{ fontWeight: 700, fontSize: 16, color: "#e1e4e8" }}>
        EventFlow
      </span>
      <span style={{
        fontSize: 11, color: "#8b949e", background: "#21262d",
        padding: "2px 8px", borderRadius: 20,
      }}>
        Dashboard
      </span>
    </div>
  );
}

function ModeToggle({
  mode, onChange,
}: {
  mode: DashboardMode;
  onChange: (m: DashboardMode) => void;
}) {
  return (
    <div style={{
      display: "flex", gap: 2,
      background: "#161b22", border: "1px solid #30363d",
      borderRadius: 8, padding: 3,
    }}>
      {(["live", "replay"] as DashboardMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: "4px 14px", borderRadius: 6, fontSize: 12,
            fontWeight: 600, border: "none", cursor: "pointer",
            background: mode === m ? "#21262d" : "transparent",
            color: mode === m
              ? m === "live" ? "#3fb950" : "#d29922"
              : "#8b949e",
          }}
        >
          {m === "live" ? "● Live" : "▶ Replay"}
        </button>
      ))}
    </div>
  );
}
