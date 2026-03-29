// dashboard/src/components/StatusBadge.tsx

type Status = "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED" | "DEAD_LETTERED";

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  QUEUED:        { label: "Queued",       color: "#58a6ff", bg: "rgba(88,166,255,0.12)" },
  PROCESSING:    { label: "Processing",   color: "#d29922", bg: "rgba(210,153,34,0.12)" },
  SUCCESS:       { label: "Success",      color: "#3fb950", bg: "rgba(63,185,80,0.12)"  },
  FAILED:        { label: "Failed",       color: "#f85149", bg: "rgba(248,81,73,0.12)"  },
  DEAD_LETTERED: { label: "Dead Letter",  color: "#bc8cff", bg: "rgba(188,140,255,0.12)"},
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.FAILED;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.color,
          display: "inline-block",
          animation: status === "PROCESSING" ? "pulse 1.2s infinite" : "none",
        }}
      />
      {cfg.label}
    </span>
  );
}
