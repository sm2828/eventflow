import React from "react";
// dashboard/src/components/Pagination.tsx

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}

const btnStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
  padding: "5px 12px",
  fontSize: 13,
  borderRadius: 6,
  border: "1px solid",
  borderColor: active ? "#58a6ff" : "#30363d",
  background: active ? "rgba(88,166,255,0.15)" : "transparent",
  color: disabled ? "#484f58" : active ? "#58a6ff" : "#e1e4e8",
  cursor: disabled ? "default" : "pointer",
  pointerEvents: disabled ? "none" : "auto",
});

export function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderTop: "1px solid #21262d",
        marginTop: 4,
      }}
    >
      <span style={{ fontSize: 12, color: "#8b949e" }}>
        {from}–{to} of {total.toLocaleString()} events
      </span>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          style={btnStyle(false, page === 1)}
          onClick={() => onPageChange(page - 1)}
        >
          ← Prev
        </button>

        {/* Page number chips — show window of 5 */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4));
          const p = start + i;
          return (
            <button
              key={p}
              style={btnStyle(p === page, false)}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          );
        })}

        <button
          style={btnStyle(false, page === totalPages)}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
