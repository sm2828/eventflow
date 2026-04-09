import React, { useState } from "react";
import { api } from "../lib/api";

const TEST_EVENTS_POOL = [
  // User events (valid)
  { type: "user.signup",       payload: { email: "user1@example.com", plan: "pro", source: "organic" } },
  { type: "user.login",        payload: { email: "user2@example.com", device: "mobile", ip: "192.168.1.1" } },
  { type: "user.logout",       payload: { email: "user3@example.com", sessionDuration: 3600 } },
  { type: "user.updated",      payload: { userId: "usr_abc123", fields: ["email", "name"], source: "user" } },
  { type: "user.deleted",      payload: { userId: "usr_xyz789", reason: "requested", deletedAt: new Date().toISOString() } },
  
  // User event - INVALID: missing email (triggers validation error)
  { type: "user.signup",       payload: { userId: "usr_fail_001", plan: "pro" } },
  
  // Order events (valid)
  { type: "order.created",     payload: { orderId: "ord_001", userId: "usr_123", amount: 99.99, currency: "USD", items: 3 } },
  { type: "order.updated",     payload: { orderId: "ord_002", status: "confirmed", updatedAt: new Date().toISOString() } },
  { type: "order.shipped",     payload: { orderId: "ord_003", carrier: "FedEx", trackingId: "TRK12345", weight: 2.5 } },
  { type: "order.delivered",   payload: { orderId: "ord_004", userId: "usr_456", deliveredAt: new Date().toISOString() } },
  { type: "order.cancelled",   payload: { orderId: "ord_005", reason: "customer_request", refundAmount: 89.99 } },
  
  // Payment events (valid - including ~5% failure rate from processor)
  { type: "payment.processed", payload: { transactionId: "txn_001", amount: 49.99, status: "success", method: "card" } },
  { type: "payment.processed", payload: { transactionId: "txn_002", amount: 29.99, status: "success", method: "paypal" } },
  { type: "payment.processed", payload: { transactionId: "txn_003", amount: 199.99, status: "success", method: "card" } },
  
  // Inventory events
  { type: "inventory.updated", payload: { sku: "SKU-12345", delta: -5, warehouse: "US-EAST", quantity: 150 } },
  { type: "inventory.low",     payload: { sku: "SKU-67890", currentStock: 10, threshold: 20, warehouse: "EU-WEST" } },
  { type: "inventory.restocked", payload: { sku: "SKU-11111", quantity: 500, source: "supplier", purchaseOrderId: "PO-999" } },
  
  // Notification events
  { type: "notification.sent", payload: { notificationId: "ntf_001", userId: "usr_789", channel: "email", type: "welcome" } },
  { type: "notification.clicked", payload: { notificationId: "ntf_002", userId: "usr_890", linkId: "lnk_123", campaign: "summer_sale" } },
  
  // Session events
  { type: "session.started",   payload: { sessionId: "ses_001", userId: "usr_111", device: "desktop", os: "macOS" } },
  { type: "session.ended",     payload: { sessionId: "ses_002", duration: 1800, pagesViewed: 15, bounced: false } },
  
  // Analytics events
  { type: "page.viewed",       payload: { pageId: "page_001", userId: "usr_222", path: "/products", referrer: "google" } },
  { type: "product.viewed",    payload: { productId: "prd_001", userId: "usr_333", category: "electronics", price: 299.99 } },
  { type: "cart.updated",      payload: { cartId: "cart_001", userId: "usr_444", itemCount: 5, totalAmount: 450.00 } },
];

const NUM_TEST_EVENTS = 5;

type Status = "idle" | "running" | "done" | "error";

interface SentEvent {
  type: string;
  id: string;
  ok: boolean;
}

function getRandomEvents(count: number) {
  // Always include at least one intentional failure for demo purposes
  const failureEvent = TEST_EVENTS_POOL.find(e => e.type === "user.signup" && !e.payload.email);
  const failureEvents = failureEvent ? [failureEvent] : [];
  
  const remaining = TEST_EVENTS_POOL.filter(e => !failureEvents.includes(e));
  const shuffled = remaining.sort(() => Math.random() - 0.5);
  
  const selected = [
    ...failureEvents.slice(0, Math.min(failureEvents.length, Math.floor(count / 2))),
    ...shuffled.slice(0, count - Math.min(failureEvents.length, Math.floor(count / 2))),
  ];
  
  return selected.slice(0, count);
}

export function TestEventsButton({ onDone }: { onDone?: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [sent, setSent] = useState<SentEvent[]>([]);
  const [open, setOpen] = useState(false);

  const run = async () => {
    setStatus("running");
    setSent([]);
    setOpen(true);

    const selectedEvents = getRandomEvents(NUM_TEST_EVENTS);

    for (const evt of selectedEvents) {
      if (!evt) continue;
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
          ? `⏳ Sending ${sent.length}/${NUM_TEST_EVENTS}…`
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
