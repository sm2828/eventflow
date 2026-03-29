import React, { useState } from "react";
import { ChartData } from "../lib/api";

interface Props {
  data: ChartData | null;
  loading: boolean;
  onWindowChange: (w: number) => void;
  window: number;
}

const WINDOWS = [
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

function MiniBarChart({
  points,
  valueKey,
  color,
  label,
}: {
  points: ChartData["points"];
  valueKey: "count" | "failed";
  color: string;
  label: string;
}) {
  const values = points.map((p) => p[valueKey]);
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0);

  return (
    <div style={{ flex: 1 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color }}>
          {total.toLocaleString()}
        </span>
      </div>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 2,
        height: 40, overflow: "hidden",
      }}>
        {points.length === 0 ? (
          <div style={{
            width: "100%", textAlign: "center", fontSize: 11,
            color: "#484f58", lineHeight: "40px",
          }}>
            no data
          </div>
        ) : (
          points.map((p, i) => {
            const v = p[valueKey];
            const h = max > 0 ? Math.max(2, Math.round((v / max) * 40)) : 2;
            return (
              <div
                key={i}
                title={`${p.timestamp.slice(11, 16)}: ${v}`}
                style={{
                  flex: 1, height: h, background: color,
                  opacity: v === 0 ? 0.15 : 0.85,
                  borderRadius: "2px 2px 0 0", minWidth: 2,
                  transition: "height 0.2s",
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export function ChartsBar({ data, loading, onWindowChange, window: win }: Props) {
  return (
    <div style={{
      background: "#0d1117",
      border: "1px solid #21262d",
      borderRadius: 8, padding: "16px 20px",
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e1e4e8" }}>
          Activity
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => onWindowChange(w.value)}
              style={{
                padding: "3px 10px", fontSize: 11, borderRadius: 20,
                border: "1px solid",
                borderColor: win === w.value ? "#58a6ff" : "#30363d",
                background: win === w.value ? "rgba(88,166,255,0.12)" : "transparent",
                color: win === w.value ? "#58a6ff" : "#8b949e",
                cursor: "pointer",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div style={{ height: 60, display: "flex", alignItems: "center",
          justifyContent: "center", color: "#484f58", fontSize: 13 }}>
          Loading chart data…
        </div>
      ) : (
        <div style={{ display: "flex", gap: 32 }}>
          <MiniBarChart
            points={data.points}
            valueKey="count"
            color="#58a6ff"
            label="Events"
          />
          <div style={{ width: 1, background: "#21262d", flexShrink: 0 }} />
          <MiniBarChart
            points={data.points}
            valueKey="failed"
            color="#f85149"
            label="Failures"
          />
        </div>
      )}
    </div>
  );
}
