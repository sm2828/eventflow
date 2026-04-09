// dashboard/src/App.tsx
import React, { useState, useEffect } from "react";
import { MetricsBar } from "./components/MetricsBar";
import { EventTable } from "./components/EventTable";
import { EventDetail } from "./components/EventDetail";
import { Filters } from "./components/Filters";
import { Pagination } from "./components/Pagination";
import { ChartsBar } from "./components/ChartsBar";
import { ReplayMode } from "./components/ReplayMode";
import { TestEventsButton } from "./components/TestEventsButton";
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showStartupNotice, setShowStartupNotice] = useState(true);

  const { events, total, page, pageSize, loading, error, goToPage, retry, replay, refresh } =
    useEvents({
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      autoRefresh: mode === "live" && autoRefresh,
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
            <TestEventsButton onDone={refresh} />
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
                autoRefresh={autoRefresh}
                onAutoRefreshChange={setAutoRefresh}
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

        </main>
      </div>

      {showStartupNotice && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.55)", padding: 24,
        }}>
          <div style={{
            width: "100%", maxWidth: 520, borderRadius: 16,
            background: "#0d1117", border: "1px solid #30363d",
            boxShadow: "0 18px 60px rgba(0,0,0,0.45)", padding: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "#e1e4e8" }}>
                  Backend Startup Notice
                </h2>
                <p style={{ margin: "8px 0 0", color: "#8b949e", fontSize: 13 }}>
                  Please allow about 30 seconds for backend services to spin up after loading this page.
                </p>
              </div>
              <button
                onClick={() => setShowStartupNotice(false)}
                style={{
                  color: "#8b949e", background: "transparent", border: "none",
                  cursor: "pointer", fontSize: 16, fontWeight: 700,
                }}
                aria-label="Close startup notice"
              >
                ×
              </button>
            </div>
            <div style={{ color: "#c9d1d9", fontSize: 14, lineHeight: 1.7 }}>
              <p>
                The dashboard may take a short moment to connect while the backend and worker services initialize.
              </p>
              <p>
                Note: the free plan limits usage and may impact startup times or request reliability.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setShowStartupNotice(false)}
                style={{
                  padding: "10px 16px", borderRadius: 8,
                  background: "#238636", color: "#f0f6fc", border: "none",
                  cursor: "pointer", fontWeight: 600,
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

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
