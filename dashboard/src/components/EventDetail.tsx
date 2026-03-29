import React, { useState, useEffect } from "react";
import { Event, TimelineData, ReplayChain, api } from "../lib/api";
import { StatusBadge } from "./StatusBadge";
import { EventTimeline } from "./EventTimeline";

interface Props {
  event: Event | null;
  onClose: () => void;
  onRetry: (id: string) => void;
  onReplay: (id: string) => Promise<any>;
}

const row: React.CSSProperties = {
  display: "flex", justifyContent: "space-between",
  alignItems: "flex-start", padding: "10px 0",
  borderBottom: "1px solid #21262d", gap: 12,
};
const label: React.CSSProperties = {
  fontSize: 12, color: "#8b949e", fontWeight: 600,
  minWidth: 110, paddingTop: 2,
};
const value: React.CSSProperties = {
  fontSize: 13, color: "#e1e4e8",
  textAlign: "right", wordBreak: "break-all",
};

type Tab = "details" | "timeline" | "replays";

export function EventDetail({ event, onClose, onRetry, onReplay }: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [replayChain, setReplayChain] = useState<ReplayChain | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    setTab("details");
    setTimeline(null);
    setReplayChain(null);
    setReplayMessage(null);
  }, [event?.id]);

  useEffect(() => {
    if (!event || tab !== "timeline") return;
    setTimelineLoading(true);
    api.events.timeline(event.id)
      .then(setTimeline)
      .finally(() => setTimelineLoading(false));
  }, [event?.id, tab]);

  useEffect(() => {
    if (!event || tab !== "replays") return;
    setReplayLoading(true);
    api.events.replayChain(event.id)
      .then(setReplayChain)
      .finally(() => setReplayLoading(false));
  }, [event?.id, tab]);

  const handleReplay = async () => {
    if (!event) return;
    try {
      const result = await onReplay(event.id) as any;
      setReplayMessage(`Replay created: ${String(result?.id ?? "").slice(0, 8)}…`);
    } catch {
      setReplayMessage("Replay failed");
    }
  };

  if (!event) return null;

  const isFailure = event.status === "FAILED" || event.status === "DEAD_LETTERED";
  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "6px 14px", fontSize: 12, fontWeight: 600,
    border: "none", borderBottom: "2px solid",
    borderBottomColor: tab === t ? "#58a6ff" : "transparent",
    background: "transparent",
    color: tab === t ? "#58a6ff" : "#8b949e",
    cursor: "pointer",
  });

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 40,
      }} />

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 520, background: "#0d1117",
        border: "1px solid #30363d", zIndex: 50,
        overflowY: "auto", padding: 24,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Event Detail</h2>
          <button onClick={onClose} style={{
            background: "transparent", border: "none",
            color: "#8b949e", fontSize: 20, cursor: "pointer", padding: 4,
          }}>✕</button>
        </div>

        {/* Status + replay badge */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <StatusBadge status={event.status} />
          {event.replayOf && (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 12,
              background: "rgba(110,64,201,0.12)", color: "#bc8cff",
              border: "1px solid rgba(110,64,201,0.3)",
            }}>
              ↺ replay
            </span>
          )}
          {event.replayCount > 0 && (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 12,
              background: "#21262d", color: "#8b949e",
            }}>
              replayed {event.replayCount}×
            </span>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid #21262d", marginBottom: 16,
        }}>
          <button style={tabStyle("details")} onClick={() => setTab("details")}>Details</button>
          <button style={tabStyle("timeline")} onClick={() => setTab("timeline")}>Timeline</button>
          <button style={tabStyle("replays")} onClick={() => setTab("replays")}>
            Replays {event.replayCount > 0 ? `(${event.replayCount})` : ""}
          </button>
        </div>

        {/* ── Details tab ── */}
        {tab === "details" && (
          <>
            <div style={row}>
              <span style={label}>ID</span>
              <code style={{ ...value, fontSize: 11, color: "#8b949e" }}>{event.id}</code>
            </div>
            <div style={row}>
              <span style={label}>Type</span>
              <code style={{ ...value, color: "#79c0ff" }}>{event.type}</code>
            </div>
            <div style={row}>
              <span style={label}>Source</span>
              <span style={value}>{event.source}</span>
            </div>
            <div style={row}>
              <span style={label}>Attempts</span>
              <span style={value}>{event.attempts}</span>
            </div>
            <div style={row}>
              <span style={label}>Created</span>
              <span style={value}>{new Date(event.createdAt).toLocaleString()}</span>
            </div>
            {event.processedAt && (
              <div style={row}>
                <span style={label}>Processed</span>
                <span style={value}>{new Date(event.processedAt).toLocaleString()}</span>
              </div>
            )}
            {event.replayOf && (
              <div style={row}>
                <span style={label}>Replay Of</span>
                <code style={{ ...value, fontSize: 11, color: "#bc8cff" }}>
                  {event.replayOf.slice(0, 16)}…
                </code>
              </div>
            )}

            {/* Error section — prominent for failures */}
            {event.errorMessage && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "#f85149", marginBottom: 8,
                }}>
                  ERROR
                </div>
                <div style={{
                  background: "rgba(248,81,73,0.08)",
                  border: "1px solid rgba(248,81,73,0.25)",
                  borderRadius: 6, padding: "10px 12px",
                  fontSize: 12, color: "#f85149", wordBreak: "break-word",
                }}>
                  {event.errorMessage}
                </div>
                {event.errorStack && (
                  <pre style={{
                    marginTop: 8, fontSize: 10, color: "#8b949e",
                    background: "#161b22", border: "1px solid #30363d",
                    borderRadius: 6, padding: "10px 12px",
                    overflowX: "auto", whiteSpace: "pre-wrap",
                    wordBreak: "break-all", maxHeight: 180, overflow: "auto",
                  }}>
                    {event.errorStack}
                  </pre>
                )}
              </div>
            )}

            {/* Payload */}
            <div style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "#8b949e", marginBottom: 8,
              }}>
                PAYLOAD
              </div>
              <pre style={{
                background: "#161b22", border: "1px solid #30363d",
                borderRadius: 6, padding: 14, fontSize: 12,
                color: "#e1e4e8", overflowX: "auto", lineHeight: 1.6,
                maxHeight: 240, overflow: "auto",
              }}>
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>

            {/* Actions */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {replayMessage && (
                <div style={{
                  padding: "8px 12px", borderRadius: 6, fontSize: 12,
                  background: "rgba(63,185,80,0.1)", color: "#3fb950",
                  border: "1px solid rgba(63,185,80,0.3)",
                }}>
                  ✓ {replayMessage}
                </div>
              )}

              <button
                onClick={handleReplay}
                style={{
                  width: "100%", padding: "10px 16px",
                  background: "rgba(88,166,255,0.1)",
                  border: "1px solid #58a6ff",
                  borderRadius: 6, color: "#58a6ff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                ↺ Replay Event
              </button>

              {isFailure && (
                <button
                  onClick={() => { onRetry(event.id); onClose(); }}
                  style={{
                    width: "100%", padding: "10px 16px",
                    background: "#238636", border: "1px solid #2ea043",
                    borderRadius: 6, color: "#fff",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  ↺ Retry (Same Record)
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Timeline tab ── */}
        {tab === "timeline" && (
          <EventTimeline data={timeline} loading={timelineLoading} />
        )}

        {/* ── Replays tab ── */}
        {tab === "replays" && (
          <div>
            {replayLoading && (
              <div style={{ color: "#8b949e", fontSize: 13, padding: "20px 0" }}>
                Loading replay history…
              </div>
            )}
            {!replayLoading && replayChain && replayChain.replays.length === 0 && (
              <div style={{ color: "#484f58", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                No replays yet. Use the "Replay Event" button on the Details tab.
              </div>
            )}
            {!replayLoading && replayChain && replayChain.replays.map((r, i) => (
              <div key={r.id} style={{
                background: "#161b22", border: "1px solid #30363d",
                borderRadius: 6, padding: "12px 14px", marginBottom: 8,
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 6,
                }}>
                  <span style={{ fontSize: 12, color: "#8b949e" }}>
                    Replay #{i + 1}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <code style={{ fontSize: 11, color: "#8b949e" }}>
                    {r.id.slice(0, 16)}…
                  </code>
                  <span style={{ fontSize: 11, color: "#484f58" }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
                {r.errorMessage && (
                  <div style={{
                    marginTop: 6, fontSize: 11, color: "#f85149",
                    padding: "4px 8px", background: "rgba(248,81,73,0.08)",
                    borderRadius: 4, wordBreak: "break-word",
                  }}>
                    {r.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
