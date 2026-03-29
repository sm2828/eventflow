import React from "react";
import { TimelineData } from "../lib/api";

interface Props {
  data: TimelineData | null;
  loading: boolean;
}

const STATUS_COLOR = {
  done: "#3fb950",
  active: "#d29922",
  pending: "#484f58",
  error: "#f85149",
} as const;

function fmt(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function EventTimeline({ data, loading }: Props) {
  if (loading) {
    return (
      <div style={{ padding: "16px 0", color: "#8b949e", fontSize: 13 }}>
        Loading timeline…
      </div>
    );
  }
  if (!data) return null;

  const { steps, totalDurationMs, event } = data;

  return (
    <div style={{ marginTop: 20 }}>
      {/* Section header */}
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#8b949e", marginBottom: 14,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>LIFECYCLE TIMELINE</span>
        {totalDurationMs !== null && (
          <span style={{ color: "#e1e4e8", fontWeight: 700 }}>
            Total: {fmt(totalDurationMs)}
          </span>
        )}
      </div>

      {/* Replay badge */}
      {event.replayOf && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(110,64,201,0.12)", border: "1px solid rgba(110,64,201,0.3)",
          borderRadius: 6, padding: "4px 10px", marginBottom: 14, fontSize: 12,
          color: "#bc8cff",
        }}>
          ↺ Replay of <code style={{ fontSize: 11 }}>{event.replayOf.slice(0, 8)}…</code>
        </div>
      )}

      {/* Steps */}
      <div style={{ position: "relative" }}>
        {/* Vertical rail */}
        <div style={{
          position: "absolute", left: 10, top: 16,
          width: 2, height: `calc(100% - 32px)`,
          background: "#21262d",
        }} />

        {steps.map((step, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            marginBottom: i < steps.length - 1 ? 16 : 0,
            position: "relative",
          }}>
            {/* Dot */}
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              border: `2px solid ${STATUS_COLOR[step.status]}`,
              background: step.status === "active"
                ? STATUS_COLOR[step.status]
                : step.status === "pending"
                ? "#0d1117"
                : `${STATUS_COLOR[step.status]}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1, marginTop: 1,
            }}>
              {step.status === "done" && (
                <span style={{ color: STATUS_COLOR.done, fontSize: 10, lineHeight: 1 }}>✓</span>
              )}
              {step.status === "error" && (
                <span style={{ color: STATUS_COLOR.error, fontSize: 10, lineHeight: 1 }}>✕</span>
              )}
              {step.status === "active" && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#0d1117", display: "block",
                }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingTop: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: step.status === "pending" ? "#484f58" : "#e1e4e8",
                }}>
                  {step.label}
                </span>
                <span style={{ fontSize: 11, color: "#8b949e" }}>
                  {fmtTime(step.timestamp)}
                </span>
              </div>
              {step.durationMs !== null && step.durationMs > 0 && (
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                  +{fmt(step.durationMs)} since previous
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Attempt logs */}
      {event.logs && event.logs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "#8b949e", marginBottom: 10,
          }}>
            ATTEMPT HISTORY ({event.logs.length})
          </div>
          {event.logs.map((log, i) => (
            <div key={i} style={{
              background: "#161b22", border: "1px solid #30363d",
              borderRadius: 6, padding: "10px 12px", marginBottom: 8,
              fontSize: 12,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: log.errorStack ? 6 : 0,
              }}>
                <span style={{ color: "#8b949e" }}>
                  Attempt {log.attempt}
                  {log.durationMs !== null && (
                    <span style={{ marginLeft: 8, color: "#484f58" }}>
                      {fmt(log.durationMs)}
                    </span>
                  )}
                </span>
                <span style={{
                  color: log.status === "SUCCESS" ? "#3fb950"
                    : log.status === "PROCESSING" ? "#d29922"
                    : "#f85149",
                  fontWeight: 600,
                }}>
                  {log.status}
                </span>
              </div>
              {log.message && (
                <div style={{ color: "#e1e4e8", marginBottom: log.errorStack ? 6 : 0 }}>
                  {log.message}
                </div>
              )}
              {log.errorStack && (
                <pre style={{
                  margin: 0, fontSize: 10, color: "#f85149",
                  background: "rgba(248,81,73,0.06)",
                  borderRadius: 4, padding: "6px 8px",
                  overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                  maxHeight: 120, overflow: "auto",
                }}>
                  {log.errorStack}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
