import React, { useState } from "react";
import { api } from "../lib/api";

const TEST_EVENTS = [
  { type: "user.signup",       payload: { email: "demo@example.com", plan: "pro" } },
  { type: "order.created",     payload: { orderId: "ord_demo", amount: 49.99, currency: "USD" } },
  { type: "payment.processed", payload: { transactionId: "txn_demo", amount: 49.99, status: "success" } },
  { type: "user.login",        payload: { email: "demo@example.com", device: "desktop" } },
  { type: "order.shipped",     payload: { orderId: "ord_demo", carrier: "FedEx", trackingId: "TRK123" } },
];

type Status = "idle" | "running" | "done" | "error";

interface SentEvent {
  type: string;
  id: string;
  ok: boolean;
}

export function TestEventsButton({ onDone }: { onDone?: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [sent, setSent] = useState<SentEvent[]>([]);
  const [open, setOpen] = useState(false);

  const run = async () => {
    setStatus("running");
    setSent([]);
    setOpen(true);

    for (const evt of TEST_EVENTS) {
      // randomise the payload slightly so each run creates distinct events
      const payload = {
        ...evt.payload,
        testId: Math.random().toString(36).slice(2, 8),
        ts: new Date().toISOString(),
      };

      try {
        const result = await api.events.create(evt.type, payload);
        setSent((s) => [...s, { type: evt.type, id: result.id, ok: true }]);
      } catch (err) {
        setSent((s) => [...s, { type: evt.type, id: "error", ok: false }]);
      }

      // small delay so you can watch them appear one by one
      await new Promise((r) => setTimeout(r, 300));
    }

    setStatus("done");
    onDone?.();
  };

  const reset = () => {
    setStatus("idle");
    setSent([]);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={status === "idle" || status === "done" ? run : undefined}
        disabled={status === "running"}
        style={{
          padding: "6px 16px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: "1px solid",
          cursor: status === "running" ? "default" : "pointer",
          borderColor: status === "done" ? "#3fb950"
            : status === "running" ? "#d29922"
            : "#58a6ff",
          background: status === "done" ? "rgba(63,185,80,0.12)"
            : status === "running" ? "rgba(210,153,34,0.12)"
            : "rgba(88,166,255,0.12)",
          color: status === "done" ? "#3fb950"
            : status === "running" ? "#d29922"
            : "#58a6ff",
          transition: "all 0.2s",
          whiteSpace: "nowrap",
        }}
      >
        {status === "running"
          ? `⏳ Sending ${sent.length + 1}/${TEST_EVENTS.length}…`
          : status === "done"
          ? "✓ Sent — run again?"
          : "⚡ Send events"}
      </button>

      {/* Drop-down log */}
      {open && sent.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 280,
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 8,
          padding: "10px 12px",
          zIndex: 100,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600,
              letterSpacing: "0.06em", color: "#8b949e",
              textTransform: "uppercase" }}>
              Events sent
            </span>
            {status === "done" && (
              <button onClick={reset} style={{
                background: "transparent", border: "none",
                color: "#8b949e", fontSize: 12, cursor: "pointer",
              }}>
                ✕ close
              </button>
            )}
          </div>

          {sent.map((e, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center",
              gap: 8, padding: "4px 0",
              borderBottom: i < sent.length - 1 ? "1px solid #21262d" : "none",
            }}>
              <span style={{ fontSize: 13 }}>{e.ok ? "✓" : "✕"}</span>
              <code style={{
                fontSize: 11, color: "#79c0ff", flex: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {e.type}
              </code>
              <code style={{ fontSize: 10, color: "#484f58" }}>
                {e.ok ? e.id.slice(0, 7) : "failed"}
              </code>
            </div>
          ))}

          {status === "done" && (
            <div style={{
              marginTop: 8, fontSize: 11, color: "#8b949e", textAlign: "center",
            }}>
              Check the dashboard — events appear within seconds
            </div>
          )}
        </div>
      )}
    </div>
  );
}
