import React from "react";
// dashboard/src/components/Filters.tsx

interface Props {
  status: string;
  type: string;
  onStatusChange: (s: string) => void;
  onTypeChange: (t: string) => void;
  onRefresh: () => void;
  lastRefreshed: Date | null;
}

const selectStyle: React.CSSProperties = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 6,
  color: "#e1e4e8",
  padding: "6px 12px",
  fontSize: 13,
  cursor: "pointer",
  outline: "none",
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  width: 200,
};

export function Filters({
  status,
  type,
  onStatusChange,
  onTypeChange,
  onRefresh,
  lastRefreshed,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">All Statuses</option>
        <option value="QUEUED">Queued</option>
        <option value="PROCESSING">Processing</option>
        <option value="SUCCESS">Success</option>
        <option value="FAILED">Failed</option>
        <option value="DEAD_LETTERED">Dead Letter</option>
      </select>

      <input
        placeholder="Filter by type (e.g. user.signup)"
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        style={inputStyle}
      />

      <button
        onClick={onRefresh}
        style={{
          ...selectStyle,
          padding: "6px 14px",
          fontWeight: 600,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#58a6ff")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#30363d")}
      >
        ↻ Refresh
      </button>

      {lastRefreshed && (
        <span style={{ fontSize: 12, color: "#484f58", marginLeft: 4 }}>
          Updated {lastRefreshed.toLocaleTimeString()}
          {" · "}
          <span style={{ color: "#3fb950" }}>● auto-refreshing</span>
        </span>
      )}
    </div>
  );
}
