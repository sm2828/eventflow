import React from "react";
import { Event } from "../lib/api";
import { StatusBadge } from "./StatusBadge";

interface Props {
  events: Event[];
  loading: boolean;
  onRetry: (id: string) => void;
  onSelect: (event: Event) => void;
}

const th: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left",
  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "#8b949e",
  borderBottom: "1px solid #21262d", whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "12px 14px", fontSize: 13,
  borderBottom: "1px solid #161b22", verticalAlign: "middle",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function EventTable({ events, loading, onRetry, onSelect }: Props) {
  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#8b949e" }}>
        Loading events…
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#8b949e" }}>
        No events found. Send your first event via the API.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>Type</th>
            <th style={th}>Status</th>
            <th style={th}>Attempts</th>
            <th style={th}>Created</th>
            <th style={th}>Processed</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#161b22")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={td} onClick={() => onSelect(event)}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <code style={{ fontSize: 11, color: "#8b949e" }}>
                    {event.id.slice(0, 8)}…
                  </code>
                  {event.replayOf && (
                    <span style={{
                      fontSize: 9, padding: "1px 5px", borderRadius: 10,
                      background: "rgba(110,64,201,0.15)", color: "#bc8cff",
                      border: "1px solid rgba(110,64,201,0.3)",
                    }}>
                      replay
                    </span>
                  )}
                </div>
              </td>
              <td style={td} onClick={() => onSelect(event)}>
                <code style={{
                  background: "#21262d", padding: "2px 8px",
                  borderRadius: 4, fontSize: 12, color: "#79c0ff",
                }}>
                  {event.type}
                </code>
              </td>
              <td style={td} onClick={() => onSelect(event)}>
                <StatusBadge status={event.status} />
              </td>
              <td style={{ ...td, textAlign: "center", color: "#8b949e" }} onClick={() => onSelect(event)}>
                {event.attempts}
              </td>
              <td style={{ ...td, color: "#8b949e", fontSize: 12 }} onClick={() => onSelect(event)}>
                {formatDate(event.createdAt)}
              </td>
              <td style={{ ...td, color: "#8b949e", fontSize: 12 }} onClick={() => onSelect(event)}>
                {event.processedAt ? formatDate(event.processedAt) : "—"}
              </td>
              <td style={td}>
                <div style={{ display: "flex", gap: 6 }}>
                  {(event.status === "FAILED" || event.status === "DEAD_LETTERED") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRetry(event.id); }}
                      style={{
                        background: "transparent", border: "1px solid #30363d",
                        color: "#e1e4e8", padding: "4px 10px",
                        borderRadius: 6, fontSize: 11, cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f85149")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#30363d")}
                    >
                      ↺ Retry
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
