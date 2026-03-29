import React from "react";
// dashboard/src/components/MetricsBar.tsx
import { Metrics } from "../lib/api";

interface Props {
  metrics: Metrics | null;
  loading: boolean;
}

const statStyle: React.CSSProperties = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 8,
  padding: "16px 20px",
  minWidth: 120,
  flex: 1,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#8b949e",
  marginBottom: 6,
};

const valueStyle = (color: string): React.CSSProperties => ({
  fontSize: 28,
  fontWeight: 700,
  color,
  lineHeight: 1,
});

const STATUS_COLORS: Record<string, string> = {
  total: "#e1e4e8",
  queued: "#58a6ff",
  processing: "#d29922",
  success: "#3fb950",
  failed: "#f85149",
  deadLettered: "#6e40c9",
};

export function MetricsBar({ metrics, loading }: Props) {
  if (loading || !metrics) {
    return (
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ ...statStyle, opacity: 0.4, height: 80 }} />
        ))}
      </div>
    );
  }

  const stats = [
    { label: "Total", key: "total", value: metrics.total },
    { label: "Queued", key: "queued", value: metrics.queued },
    { label: "Processing", key: "processing", value: metrics.processing },
    { label: "Success", key: "success", value: metrics.success },
    { label: "Failed", key: "failed", value: metrics.failed },
    { label: "Dead Letter", key: "deadLettered", value: metrics.deadLettered },
  ];

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
      {stats.map((s) => (
        <div key={s.key} style={statStyle}>
          <div style={labelStyle}>{s.label}</div>
          <div style={valueStyle(STATUS_COLORS[s.key])}>{s.value.toLocaleString()}</div>
        </div>
      ))}
      <div style={{ ...statStyle, borderColor: "#238636" }}>
        <div style={labelStyle}>Success Rate</div>
        <div style={valueStyle("#3fb950")}>{metrics.successRate}%</div>
      </div>
    </div>
  );
}
